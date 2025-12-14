package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// App holds application level configuration.
type App struct {
	Addr         string   `yaml:"addr"`
	JWTSecret    string   `yaml:"jwt_secret"`
	SM4Key       string   `yaml:"sm4_key"`
	AllowOrigins []string `yaml:"allow_origins"`
}

// Database describes the database connection.
type Database struct {
	Driver  string `yaml:"driver"`
	DSN     string `yaml:"dsn"`
	MaxOpen int    `yaml:"max_open"`
	MaxIdle int    `yaml:"max_idle"`
}

// Security holds bootstrap security settings.
type Security struct {
	DefaultAdminUser     string `yaml:"default_admin_user"`
	DefaultAdminPassword string `yaml:"default_admin_password"`
}

// Config is the root configuration object.
type Config struct {
	App      App      `yaml:"app"`
	Database Database `yaml:"database"`
	Security Security `yaml:"security"`
}

// Load reads YAML configuration from the provided path.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	if cfg.App.JWTSecret == "" {
		return nil, fmt.Errorf("app.jwt_secret is required")
	}
	if cfg.App.Addr == "" {
		cfg.App.Addr = ":8080"
	}
	if cfg.Database.MaxOpen == 0 {
		cfg.Database.MaxOpen = 10
	}
	if cfg.Database.MaxIdle == 0 {
		cfg.Database.MaxIdle = 2
	}
	if cfg.Database.Driver == "" {
		cfg.Database.Driver = "mysql"
	}
	if cfg.Database.Driver != "mysql" {
		return nil, fmt.Errorf("only mysql is supported; set database.driver to mysql")
	}

	return &cfg, nil
}
