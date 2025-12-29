package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

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

// Load reads YAML configuration from the provided path and applies environment variable overrides.
// Environment variables take precedence over YAML values.
// If the config file doesn't exist, it will use environment variables and defaults only.
// Supported environment variables:
//   - SM_APP_ADDR
//   - SM_APP_JWT_SECRET
//   - SM_APP_ALLOW_ORIGINS (comma-separated)
//   - SM_DATABASE_DRIVER
//   - SM_DATABASE_DSN
//   - SM_DATABASE_MAX_OPEN
//   - SM_DATABASE_MAX_IDLE
//   - SM_SECURITY_DEFAULT_ADMIN_USER
//   - SM_SECURITY_DEFAULT_ADMIN_PASSWORD
func Load(path string) (*Config, error) {
	var cfg Config

	// Try to read config file, but don't fail if it doesn't exist
	data, err := os.ReadFile(path)
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("read config: %w", err)
		}
		// File doesn't exist, will use env vars and defaults only
	} else {
		// File exists, parse it
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return nil, fmt.Errorf("parse config: %w", err)
		}
	}

	// Apply environment variable overrides
	applyEnvOverrides(&cfg)

	// Set defaults
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

	// Validate required fields
	if cfg.App.JWTSecret == "" {
		return nil, fmt.Errorf("app.jwt_secret is required (set via config or SM_APP_JWT_SECRET)")
	}
	if cfg.Database.DSN == "" {
		return nil, fmt.Errorf("database.dsn is required (set via config or SM_DATABASE_DSN)")
	}
	if cfg.Database.Driver != "mysql" {
		return nil, fmt.Errorf("only mysql is supported; set database.driver to mysql")
	}

	return &cfg, nil
}

// applyEnvOverrides applies environment variable overrides to the config.
func applyEnvOverrides(cfg *Config) {
	// App configuration
	if v := os.Getenv("SM_APP_ADDR"); v != "" {
		cfg.App.Addr = v
	}
	if v := os.Getenv("SM_APP_JWT_SECRET"); v != "" {
		cfg.App.JWTSecret = v
	}
	if v := os.Getenv("SM_APP_SM4_KEY"); v != "" {
		cfg.App.SM4Key = v
	}
	if v := os.Getenv("SM_APP_ALLOW_ORIGINS"); v != "" {
		cfg.App.AllowOrigins = strings.Split(v, ",")
		// Trim whitespace from each origin
		for i := range cfg.App.AllowOrigins {
			cfg.App.AllowOrigins[i] = strings.TrimSpace(cfg.App.AllowOrigins[i])
		}
	}

	// Database configuration
	if v := os.Getenv("SM_DATABASE_DRIVER"); v != "" {
		cfg.Database.Driver = v
	}
	if v := os.Getenv("SM_DATABASE_DSN"); v != "" {
		cfg.Database.DSN = v
	}
	if v := os.Getenv("SM_DATABASE_MAX_OPEN"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.Database.MaxOpen = i
		}
	}
	if v := os.Getenv("SM_DATABASE_MAX_IDLE"); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			cfg.Database.MaxIdle = i
		}
	}

	// Security configuration
	if v := os.Getenv("SM_SECURITY_DEFAULT_ADMIN_USER"); v != "" {
		cfg.Security.DefaultAdminUser = v
	}
	if v := os.Getenv("SM_SECURITY_DEFAULT_ADMIN_PASSWORD"); v != "" {
		cfg.Security.DefaultAdminPassword = v
	}
}
