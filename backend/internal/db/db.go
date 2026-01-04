package db

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// NewPostgresPool creates a new PostgreSQL connection pool
func NewPostgresPool() (*pgxpool.Pool, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:54320/dino_db?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}

	return pool, nil
}

// NewRedisClient creates a new Redis client
func NewRedisClient() (*redis.Client, error) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return client, nil
}

// InitSchema initializes the database schema
func InitSchema(pool *pgxpool.Pool) error {
	ctx := context.Background()

	schema := `
	CREATE TABLE IF NOT EXISTS leaderboard (
		id SERIAL PRIMARY KEY,
		player_id VARCHAR(50) NOT NULL,
		player_name VARCHAR(100) NOT NULL,
		score INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
	`

	_, err := pool.Exec(ctx, schema)
	return err
}

// SaveScore saves a player's score to the leaderboard
func SaveScore(pool *pgxpool.Pool, playerID string, playerName string, score int) error {
	ctx := context.Background()

	_, err := pool.Exec(ctx,
		"INSERT INTO leaderboard (player_id, player_name, score) VALUES ($1, $2, $3)",
		playerID, playerName, score,
	)
	return err
}

// LeaderboardEntry represents a leaderboard entry
type LeaderboardEntry struct {
	Rank       int    `json:"rank"`
	PlayerID   string `json:"playerId"`
	PlayerName string `json:"playerName"`
	Score      int    `json:"score"`
	CreatedAt  string `json:"createdAt"`
}

// LeaderboardResponse is the paginated response
type LeaderboardResponse struct {
	Entries    []LeaderboardEntry `json:"entries"`
	TotalCount int                `json:"totalCount"`
	Page       int                `json:"page"`
	PageSize   int                `json:"pageSize"`
	TotalPages int                `json:"totalPages"`
}

// HandleLeaderboard handles the leaderboard API endpoint
func HandleLeaderboard(pool *pgxpool.Pool, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse pagination params
	page := 1
	pageSize := 10

	if p := r.URL.Query().Get("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			pageSize = parsed
		}
	}

	offset := (page - 1) * pageSize

	ctx := context.Background()

	// Get total count
	var totalCount int
	err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM leaderboard").Scan(&totalCount)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Get paginated entries
	rows, err := pool.Query(ctx, `
		SELECT player_id, player_name, score, created_at
		FROM leaderboard
		ORDER BY score DESC
		LIMIT $1 OFFSET $2
	`, pageSize, offset)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	rank := offset + 1
	for rows.Next() {
		var entry LeaderboardEntry
		var createdAt time.Time
		if err := rows.Scan(&entry.PlayerID, &entry.PlayerName, &entry.Score, &createdAt); err != nil {
			continue
		}
		entry.Rank = rank
		entry.CreatedAt = createdAt.Format(time.RFC3339)
		entries = append(entries, entry)
		rank++
	}

	if entries == nil {
		entries = []LeaderboardEntry{}
	}

	totalPages := (totalCount + pageSize - 1) / pageSize
	if totalPages == 0 {
		totalPages = 1
	}

	response := LeaderboardResponse{
		Entries:    entries,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}

	json.NewEncoder(w).Encode(response)
}
