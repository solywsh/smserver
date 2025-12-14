package server

import (
	"net/http"
	"strings"

	"backend/config"
	"backend/internal/security"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware ensures requests provide a valid JWT.
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing Authorization header"})
			return
		}
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid Authorization header"})
			return
		}
		claims, err := security.ParseToken(cfg, parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}
		c.Set("claims", claims)
		c.Next()
	}
}

// CORSMiddleware allows configurable origins for the web app.
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	allowed := strings.Join(cfg.App.AllowOrigins, ",")
	if allowed == "" {
		allowed = "*"
	}
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", allowed)
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin,Content-Type,Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
