package main

import (
	"log"
	"os"
	"time"

	"backend/config"
	"backend/internal/db"
	"backend/internal/models"
	"backend/internal/security"
	"backend/internal/server"
	"backend/internal/tasks"

	"xorm.io/xorm"
)

func main() {
	configPath := "config.yaml"
	if path := os.Getenv("SM_SERVER_CONFIG"); path != "" {
		configPath = path
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	engine, err := db.NewEngine(cfg)
	if err != nil {
		log.Fatalf("init db: %v", err)
	}
	if err := ensureAdmin(cfg, engine); err != nil {
		log.Fatalf("ensure admin: %v", err)
	}

	// Start battery poller (poll every 5 minutes)
	batteryPoller := tasks.NewBatteryPoller(engine, 5*time.Minute)
	batteryPoller.Start()

	router := server.NewRouter(cfg, engine)
	log.Printf("starting server on %s", cfg.App.Addr)
	if err := router.Run(cfg.App.Addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

// ensureAdmin seeds a default admin account if none exists.
func ensureAdmin(cfg *config.Config, engine *xorm.Engine) error {
	count, err := engine.Count(new(models.User))
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	hash, err := security.HashPassword(cfg.Security.DefaultAdminPassword)
	if err != nil {
		return err
	}
	user := models.User{
		Username: cfg.Security.DefaultAdminUser,
		Password: hash,
	}
	_, err = engine.Insert(&user)
	return err
}
