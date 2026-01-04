package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Client represents a WebSocket connection
type Client struct {
	ID      string
	Name    string // Player's display name for leaderboard
	Hub     *Hub
	Conn    *websocket.Conn
	Send    chan []byte
	RoomID  string
	InQueue bool
	Score   int
	IsAlive bool
	mu      sync.Mutex
}

// Message represents a WebSocket message
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// GameStartPayload is sent when a match is found
type GameStartPayload struct {
	RoomID       string `json:"roomId"`
	Seed         int64  `json:"seed"`
	MyID         string `json:"myId"`
	MyName       string `json:"myName"`
	OpponentID   string `json:"opponentId"`
	OpponentName string `json:"opponentName"`
}

// ScorePayload for score updates
type ScorePayload struct {
	Score int `json:"score"`
}

// JoinQueuePayload for joining the matchmaking queue
type JoinQueuePayload struct {
	Name string `json:"name"`
}

// OpponentUpdatePayload for opponent status
type OpponentUpdatePayload struct {
	Score   int  `json:"score"`
	IsAlive bool `json:"isAlive"`
}

// GameOverPayload for game end
type GameOverPayload struct {
	WinnerID string `json:"winnerId"`
	Reason   string `json:"reason"`
}

// NewClient creates a new WebSocket client
func NewClient(id string, hub *Hub, conn *websocket.Conn) *Client {
	return &Client{
		ID:      id,
		Hub:     hub,
		Conn:    conn,
		Send:    make(chan []byte, 256),
		IsAlive: true,
	}
}

// SendJSON sends a JSON message to the client
func (c *Client) SendJSON(msgType string, payload interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	msg := Message{
		Type:    msgType,
		Payload: payloadBytes,
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	select {
	case c.Send <- msgBytes:
	default:
		log.Printf("Client %s send buffer full, dropping message", c.ID)
	}
	return nil
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		}
	}
}
