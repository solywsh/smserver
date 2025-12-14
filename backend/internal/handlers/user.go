package handlers

import (
	"net/http"

	"backend/internal/models"
	"backend/internal/security"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"xorm.io/xorm"
)

// Profile returns the authenticated user info.
func Profile(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, _ := c.Get("claims")
		userClaims, ok := claims.(*jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}
		idFloat, ok := (*userClaims)["sub"].(float64)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}
		var user models.User
		if _, err := engine.ID(int64(idFloat)).Get(&user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": user.ID, "username": user.Username})
	}
}

// UpdatePassword lets authenticated user change password.
func UpdatePassword(engine *xorm.Engine) gin.HandlerFunc {
	type req struct {
		Old string `json:"old"`
		New string `json:"new"`
	}
	return func(c *gin.Context) {
		claims, _ := c.Get("claims")
		userClaims, ok := claims.(*jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}
		idFloat, ok := (*userClaims)["sub"].(float64)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}
		var body req
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var user models.User
		if _, err := engine.ID(int64(idFloat)).Get(&user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !security.CheckPassword(user.Password, body.Old) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "旧密码错误"})
			return
		}
		hash, err := security.HashPassword(body.New)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		user.Password = hash
		if _, err := engine.ID(user.ID).Cols("password").Update(&user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusOK)
	}
}
