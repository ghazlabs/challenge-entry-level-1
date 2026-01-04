package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"

	"dino-multiplayer/internal/db"
	"dino-multiplayer/internal/game"
	"dino-multiplayer/internal/ws"
)

func init() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize database connections
	pgPool, err := db.NewPostgresPool()
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer pgPool.Close()

	redisClient, err := db.NewRedisClient()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Initialize database schema
	if err := db.InitSchema(pgPool); err != nil {
		log.Fatalf("Failed to initialize database schema: %v", err)
	}

	// Initialize WebSocket hub and matchmaker
	hub := ws.NewHub()
	go hub.Run()

	matchmaker := game.NewMatchmaker(redisClient, hub)
	go matchmaker.Run()

	// HTTP handlers
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(hub, matchmaker, pgPool, w, r)
	})

	http.HandleFunc("/api/leaderboard", func(w http.ResponseWriter, r *http.Request) {
		db.HandleLeaderboard(pgPool, w, r)
	})

	// CORS middleware for development
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
