package game

import (
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"dino-multiplayer/internal/ws"
)

// Matchmaker handles player queue and room creation
type Matchmaker struct {
	redisClient *redis.Client
	hub         *ws.Hub
	queue       chan *ws.Client
}

// NewMatchmaker creates a new matchmaker
func NewMatchmaker(redisClient *redis.Client, hub *ws.Hub) *Matchmaker {
	return &Matchmaker{
		redisClient: redisClient,
		hub:         hub,
		queue:       make(chan *ws.Client, 100),
	}
}

// AddToQueue adds a client to the matchmaking queue
func (m *Matchmaker) AddToQueue(client *ws.Client) {
	m.queue <- client
}

// Run starts the matchmaker loop
func (m *Matchmaker) Run() {
	var waiting *ws.Client

	for {
		select {
		case client := <-m.queue:
			if waiting == nil {
				waiting = client
				log.Printf("Player %s waiting in queue", client.ID)
			} else {
				// We have 2 players - create a match!
				m.createMatch(waiting, client)
				waiting = nil
			}
		}
	}
}

func (m *Matchmaker) createMatch(player1, player2 *ws.Client) {
	roomID := uuid.New().String()
	seed := rand.Int63()

	log.Printf("Creating match: Room=%s, Player1=%s, Player2=%s, Seed=%d",
		roomID, player1.ID, player2.ID, seed)

	// Assign room to both players
	player1.RoomID = roomID
	player1.InQueue = false
	player1.IsAlive = true
	player1.Score = 0

	player2.RoomID = roomID
	player2.InQueue = false
	player2.IsAlive = true
	player2.Score = 0

	// Send GAME_START to both players
	player1.SendJSON("GAME_START", ws.GameStartPayload{
		RoomID:       roomID,
		Seed:         seed,
		MyID:         player1.ID,
		MyName:       player1.Name,
		OpponentID:   player2.ID,
		OpponentName: player2.Name,
	})

	player2.SendJSON("GAME_START", ws.GameStartPayload{
		RoomID:       roomID,
		Seed:         seed,
		MyID:         player2.ID,
		MyName:       player2.Name,
		OpponentID:   player1.ID,
		OpponentName: player1.Name,
	})
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
