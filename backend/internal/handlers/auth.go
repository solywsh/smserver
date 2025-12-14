package handlers

import (
	"net/http"

	"backend/config"
	"backend/internal/models"
	"backend/internal/security"

	"github.com/gin-gonic/gin"
	"xorm.io/xorm"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// Login authenticates user and returns JWT.
func Login(cfg *config.Config, engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var user models.User
		has, err := engine.Where("username = ?", req.Username).Get(&user)
		if err != nil || !has {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		if !security.CheckPassword(user.Password, req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		token, err := security.CreateToken(cfg, &user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"token": token, "user": gin.H{"id": user.ID, "username": user.Username}})
	}
}
