package ws

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"

	"dino-multiplayer/internal/db"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Matchmaker interface to avoid import cycle
type Matchmaker interface {
	AddToQueue(client *Client)
}

// ServeWs handles WebSocket requests from clients
func ServeWs(hub *Hub, matchmaker Matchmaker, pgPool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Generate a unique client ID
	clientID := "guest_" + uuid.New().String()[:8]

	client := NewClient(clientID, hub, conn)
	hub.Register(client)

	log.Printf("Client connected: %s", clientID)

	// Start write pump in goroutine
	go client.WritePump()

	// Read pump (main message loop)
	defer func() {
		hub.Unregister(client)
		conn.Close()
		log.Printf("Client disconnected: %s", clientID)
	}()

	for {
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(messageBytes, &msg); err != nil {
			log.Printf("Failed to parse message: %v", err)
			continue
		}

		handleMessage(client, matchmaker, pgPool, &msg)
	}
}

func handleMessage(client *Client, matchmaker Matchmaker, pgPool *pgxpool.Pool, msg *Message) {
	switch msg.Type {
	case "JOIN_QUEUE":
		if !client.InQueue && client.RoomID == "" {
			var payload JoinQueuePayload
			if err := json.Unmarshal(msg.Payload, &payload); err != nil {
				log.Printf("Failed to parse join queue payload: %v", err)
				// Use client ID as fallback name
				payload.Name = client.ID
			}

			// Set player name (use ID as fallback if empty)
			if payload.Name != "" {
				client.Name = payload.Name
			} else {
				client.Name = client.ID
			}

			matchmaker.AddToQueue(client)
			client.InQueue = true
			log.Printf("Client %s (name: %s) joined queue", client.ID, client.Name)
		}

	case "UPDATE_SCORE":
		var payload ScorePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			log.Printf("Failed to parse score payload: %v", err)
			return
		}

		// Validate score (anti-cheat: score shouldn't jump more than 50 per update)
		if payload.Score-client.Score > 50 {
			log.Printf("Suspicious score jump from client %s: %d -> %d (rejected)",
				client.ID, client.Score, payload.Score)
			// Reject the update - notify opponent with last valid score
			notifyOpponent(client, "OPPONENT_UPDATE", OpponentUpdatePayload{
				Score:   client.Score,
				IsAlive: client.IsAlive,
			})
			return // Don't process this suspicious update
		}

		client.Score = payload.Score

		// Notify opponent of score update
		notifyOpponent(client, "OPPONENT_UPDATE", OpponentUpdatePayload{
			Score:   client.Score,
			IsAlive: client.IsAlive,
		})

	case "PLAYER_DIED":
		var payload ScorePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			log.Printf("Failed to parse death payload: %v", err)
			return
		}

		client.Score = payload.Score
		client.IsAlive = false

		log.Printf("Player %s died with score %d", client.ID, client.Score)

		// Notify opponent
		notifyOpponent(client, "OPPONENT_UPDATE", OpponentUpdatePayload{
			Score:   client.Score,
			IsAlive: false,
		})

		// Check if game is over (only when all players are dead)
		hub := client.Hub
		roomClients := hub.GetClientsInRoom(client.RoomID)

		allDead := true
		for _, c := range roomClients {
			if c.IsAlive {
				allDead = false
				break
			}
		}

		// Only end the game when ALL players are dead
		if allDead {
			// Determine winner by highest score
			var winner *Client
			isDraw := false
			for _, c := range roomClients {
				if winner == nil {
					winner = c
				} else if c.Score > winner.Score {
					winner = c
					isDraw = false
				} else if c.Score == winner.Score {
					isDraw = true
				}
			}

			// Notify all players that the game is over
			for _, c := range roomClients {
				if isDraw {
					c.SendJSON("GAME_OVER", GameOverPayload{
						WinnerID: "", // Empty means draw
						Reason:   "draw",
					})
				} else {
					c.SendJSON("GAME_OVER", GameOverPayload{
						WinnerID: winner.ID,
						Reason:   "all_players_died",
					})
				}
			}

			// Persist scores to leaderboard
			for _, c := range roomClients {
				if err := db.SaveScore(pgPool, c.ID, c.Name, c.Score); err != nil {
					log.Printf("Failed to save score: %v", err)
				}
			}

			// Clean up room
			for _, c := range roomClients {
				c.RoomID = ""
				c.IsAlive = true
				c.Score = 0
			}
		}
		// If not all dead, the surviving player continues playing
		// They already received OPPONENT_UPDATE notification that opponent died

	case "LEAVE_GAME":
		// Player wants to leave the game early (after dying)
		// Save their score and clean up their state
		if client.RoomID == "" {
			return // Not in a game
		}

		log.Printf("Player %s leaving game with score %d", client.ID, client.Score)

		// Save the player's score to leaderboard
		if err := db.SaveScore(pgPool, client.ID, client.Name, client.Score); err != nil {
			log.Printf("Failed to save score on leave: %v", err)
		}

		// Notify opponent that this player left
		notifyOpponent(client, "OPPONENT_LEFT", OpponentUpdatePayload{
			Score:   client.Score,
			IsAlive: false,
		})

		// Clean up this player's state so they can rejoin queue
		client.RoomID = ""
		client.IsAlive = true
		client.Score = 0
		client.InQueue = false
	}
}

func notifyOpponent(client *Client, msgType string, payload interface{}) {
	hub := client.Hub
	roomClients := hub.GetClientsInRoom(client.RoomID)

	for _, c := range roomClients {
		if c.ID != client.ID {
			c.SendJSON(msgType, payload)
		}
	}
}
