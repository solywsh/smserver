package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Create a temporary config file
	tmpFile := "test_config.yaml"
	configContent := `app:
  addr: ":9000"
  jwt_secret: "test-secret"
  allow_origins:
    - "http://example.com"
database:
  driver: "mysql"
  dsn: "test:test@tcp(localhost:3306)/test"
  max_open: 5
  max_idle: 1
security:
  default_admin_user: "testadmin"
  default_admin_password: "testpass"
`
	if err := os.WriteFile(tmpFile, []byte(configContent), 0644); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile)

	t.Run("LoadFromFile", func(t *testing.T) {
		cfg, err := Load(tmpFile)
		if err != nil {
			t.Fatalf("Load failed: %v", err)
		}

		if cfg.App.Addr != ":9000" {
			t.Errorf("Expected addr :9000, got %s", cfg.App.Addr)
		}
		if cfg.App.JWTSecret != "test-secret" {
			t.Errorf("Expected jwt_secret test-secret, got %s", cfg.App.JWTSecret)
		}
		if cfg.Database.DSN != "test:test@tcp(localhost:3306)/test" {
			t.Errorf("Expected specific DSN, got %s", cfg.Database.DSN)
		}
	})

	t.Run("EnvOverride", func(t *testing.T) {
		// Set environment variables
		os.Setenv("SM_APP_ADDR", ":8888")
		os.Setenv("SM_APP_JWT_SECRET", "env-secret")
		os.Setenv("SM_DATABASE_DSN", "env:env@tcp(envhost:3306)/envdb")
		os.Setenv("SM_DATABASE_MAX_OPEN", "20")
		os.Setenv("SM_SECURITY_DEFAULT_ADMIN_USER", "envadmin")
		os.Setenv("SM_SECURITY_DEFAULT_ADMIN_PASSWORD", "envpass")
		defer func() {
			os.Unsetenv("SM_APP_ADDR")
			os.Unsetenv("SM_APP_JWT_SECRET")
			os.Unsetenv("SM_DATABASE_DSN")
			os.Unsetenv("SM_DATABASE_MAX_OPEN")
			os.Unsetenv("SM_SECURITY_DEFAULT_ADMIN_USER")
			os.Unsetenv("SM_SECURITY_DEFAULT_ADMIN_PASSWORD")
		}()

		cfg, err := Load(tmpFile)
		if err != nil {
			t.Fatalf("Load failed: %v", err)
		}

		// Environment variables should override config file
		if cfg.App.Addr != ":8888" {
			t.Errorf("Expected addr :8888 from env, got %s", cfg.App.Addr)
		}
		if cfg.App.JWTSecret != "env-secret" {
			t.Errorf("Expected jwt_secret env-secret from env, got %s", cfg.App.JWTSecret)
		}
		if cfg.Database.DSN != "env:env@tcp(envhost:3306)/envdb" {
			t.Errorf("Expected DSN from env, got %s", cfg.Database.DSN)
		}
		if cfg.Database.MaxOpen != 20 {
			t.Errorf("Expected max_open 20 from env, got %d", cfg.Database.MaxOpen)
		}
		if cfg.Security.DefaultAdminUser != "envadmin" {
			t.Errorf("Expected admin user envadmin from env, got %s", cfg.Security.DefaultAdminUser)
		}
		if cfg.Security.DefaultAdminPassword != "envpass" {
			t.Errorf("Expected admin password envpass from env, got %s", cfg.Security.DefaultAdminPassword)
		}
	})

	t.Run("AllowOriginsEnv", func(t *testing.T) {
		os.Setenv("SM_APP_ALLOW_ORIGINS", "http://test1.com, http://test2.com , http://test3.com")
		defer os.Unsetenv("SM_APP_ALLOW_ORIGINS")

		cfg, err := Load(tmpFile)
		if err != nil {
			t.Fatalf("Load failed: %v", err)
		}

		expectedOrigins := []string{"http://test1.com", "http://test2.com", "http://test3.com"}
		if len(cfg.App.AllowOrigins) != len(expectedOrigins) {
			t.Errorf("Expected %d origins, got %d", len(expectedOrigins), len(cfg.App.AllowOrigins))
		}
		for i, origin := range expectedOrigins {
			if cfg.App.AllowOrigins[i] != origin {
				t.Errorf("Expected origin %s at index %d, got %s", origin, i, cfg.App.AllowOrigins[i])
			}
		}
	})

	t.Run("MissingJWTSecret", func(t *testing.T) {
		// Create config without JWT secret
		tmpFileNoSecret := "test_config_no_secret.yaml"
		configNoSecret := `app:
  addr: ":9000"
database:
  driver: "mysql"
  dsn: "test:test@tcp(localhost:3306)/test"
`
		if err := os.WriteFile(tmpFileNoSecret, []byte(configNoSecret), 0644); err != nil {
			t.Fatal(err)
		}
		defer os.Remove(tmpFileNoSecret)

		_, err := Load(tmpFileNoSecret)
		if err == nil {
			t.Error("Expected error for missing JWT secret, got nil")
		}
	})

	t.Run("LoadFromEnvOnly", func(t *testing.T) {
		// Test loading config from environment variables only (no config file)
		os.Setenv("SM_APP_JWT_SECRET", "env-only-secret")
		os.Setenv("SM_DATABASE_DSN", "envuser:envpass@tcp(envhost:3306)/envdb")
		defer func() {
			os.Unsetenv("SM_APP_JWT_SECRET")
			os.Unsetenv("SM_DATABASE_DSN")
		}()

		// Use a non-existent file path
		cfg, err := Load("non_existent_file.yaml")
		if err != nil {
			t.Fatalf("Load from env only failed: %v", err)
		}

		if cfg.App.JWTSecret != "env-only-secret" {
			t.Errorf("Expected jwt_secret env-only-secret from env, got %s", cfg.App.JWTSecret)
		}
		if cfg.Database.DSN != "envuser:envpass@tcp(envhost:3306)/envdb" {
			t.Errorf("Expected DSN from env, got %s", cfg.Database.DSN)
		}
		// Check defaults are applied
		if cfg.App.Addr != ":8080" {
			t.Errorf("Expected default addr :8080, got %s", cfg.App.Addr)
		}
		if cfg.Database.Driver != "mysql" {
			t.Errorf("Expected default driver mysql, got %s", cfg.Database.Driver)
		}
	})
}
