package handlers

import (
	"net/http"
	"time"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"xorm.io/xorm"
)

type CreateDeviceRequest struct {
	Name      string `json:"name" binding:"required"`
	PhoneAddr string `json:"phone_addr" binding:"required"` // Phone HTTP server address, e.g., "http://192.168.1.100:5000"
	SM4Key    string `json:"sm4_key" binding:"required"`    // SM4 encryption key from phone (32 hex chars)
	Remark    string `json:"remark"`
}

// ListDevices returns all registered devices.
func ListDevices(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var devices []models.Device
		if err := engine.Find(&devices); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": devices})
	}
}

// CreateDevice registers a new device with user-provided SM4 key and phone address.
// The SM4 key must match the key configured in the phone's SmsForwarder app.
func CreateDevice(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateDeviceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate SM4 key format (should be 32 hex characters)
		if len(req.SM4Key) != 32 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "SM4 key must be 32 hex characters"})
			return
		}

		device := models.Device{
			Name:      req.Name,
			PhoneAddr: req.PhoneAddr,
			SM4Key:    req.SM4Key,
			Status:    "unknown",
			Remark:    req.Remark,
			LastSeen:  time.Now(),
		}
		if _, err := engine.Insert(&device); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, device)
	}
}

// DeleteDevice removes a device and its related data.
func DeleteDevice(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if _, err := engine.ID(id).Delete(&models.Device{}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// Heartbeat updates device status and battery.
func Heartbeat(engine *xorm.Engine) gin.HandlerFunc {
	type hbRequest struct {
		Battery int    `json:"battery"`
		Status  string `json:"status"`
	}
	return func(c *gin.Context) {
		id := c.Param("id")
		var req hbRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		device := models.Device{}
		if _, err := engine.ID(id).Get(&device); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		device.Battery = req.Battery
		device.Status = req.Status
		device.LastSeen = time.Now()
		if _, err := engine.ID(id).Cols("battery", "status", "last_seen").Update(&device); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, device)
	}
}

// DeviceDetail returns a single device info.
func DeviceDetail(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var device models.Device
		has, err := engine.ID(id).Get(&device)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !has {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}
		c.JSON(http.StatusOK, device)
	}
}
