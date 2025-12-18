package db

import (
	"fmt"
	"time"

	"backend/config"
	"backend/internal/models"

	_ "github.com/go-sql-driver/mysql"
	"xorm.io/xorm"
)

// NewEngine builds a xorm engine from configuration and performs schema sync.
func NewEngine(cfg *config.Config) (*xorm.Engine, error) {
	driver := cfg.Database.Driver
	dsn := cfg.Database.DSN

	if driver != "mysql" {
		return nil, fmt.Errorf("only mysql driver is supported")
	}

	engine, err := xorm.NewEngine(driverName(driver), dsn)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}

	engine.SetMaxOpenConns(cfg.Database.MaxOpen)
	engine.SetMaxIdleConns(cfg.Database.MaxIdle)
	engine.ShowSQL(false) // Disable SQL logging to reduce console output
	engine.TZLocation = time.Local

	if err := engine.Sync(
		new(models.User),
		new(models.Device),
		new(models.SmsMessage),
		new(models.CallLog),
		new(models.Contact),
		new(models.Command),
	); err != nil {
		return nil, fmt.Errorf("sync schema: %w", err)
	}

	return engine, nil
}

func driverName(driver string) string {
	return "mysql"
}
