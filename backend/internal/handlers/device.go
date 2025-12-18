package handlers

import (
	"net/http"
	"time"

	"backend/internal/models"
	"backend/internal/phoneclient"

	"github.com/gin-gonic/gin"
	"xorm.io/xorm"
)

type CreateDeviceRequest struct {
	Name            string `json:"name" binding:"required"`
	PhoneAddr       string `json:"phone_addr" binding:"required"` // Phone HTTP server address, e.g., "http://192.168.1.100:5000"
	SM4Key          string `json:"sm4_key" binding:"required"`    // SM4 encryption key from phone (32 hex chars)
	Remark          string `json:"remark"`
	PollingInterval int    `json:"polling_interval"` // Polling interval in seconds (0=disabled, 5/10/15/30/60)
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

		// Validate polling interval (must be 0 or one of: 5, 10, 15, 30, 60)
		validIntervals := []int{0, 5, 10, 15, 30, 60}
		validInterval := false
		for _, v := range validIntervals {
			if req.PollingInterval == v {
				validInterval = true
				break
			}
		}
		if !validInterval {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Polling interval must be 0 (disabled) or one of: 5, 10, 15, 30, 60 seconds"})
			return
		}

		device := models.Device{
			Name:            req.Name,
			PhoneAddr:       req.PhoneAddr,
			SM4Key:          req.SM4Key,
			Status:          "unknown",
			Remark:          req.Remark,
			PollingInterval: req.PollingInterval,
			LastSeen:        time.Now(),
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

// UpdateDeviceRequest represents the request to update a device
type UpdateDeviceRequest struct {
	Name            *string `json:"name"`
	PhoneAddr       *string `json:"phone_addr"`
	SM4Key          *string `json:"sm4_key"`
	Remark          *string `json:"remark"`
	PollingInterval *int    `json:"polling_interval"`
}

// UpdateDevice updates device information (name, phone_addr, sm4_key, remark)
func UpdateDevice(engine *xorm.Engine) gin.HandlerFunc {
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

		var req UpdateDeviceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Update fields if provided
		cols := []string{}
		if req.Name != nil {
			device.Name = *req.Name
			cols = append(cols, "name")
		}
		if req.PhoneAddr != nil {
			device.PhoneAddr = *req.PhoneAddr
			cols = append(cols, "phone_addr")
		}
		if req.SM4Key != nil {
			if len(*req.SM4Key) != 32 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "SM4 key must be 32 hex characters"})
				return
			}
			device.SM4Key = *req.SM4Key
			cols = append(cols, "sm4_key")
		}
		if req.Remark != nil {
			device.Remark = *req.Remark
			cols = append(cols, "remark")
		}
		if req.PollingInterval != nil {
			// Validate polling interval
			validIntervals := []int{0, 5, 10, 15, 30, 60}
			validInterval := false
			for _, v := range validIntervals {
				if *req.PollingInterval == v {
					validInterval = true
					break
				}
			}
			if !validInterval {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Polling interval must be 0 (disabled) or one of: 5, 10, 15, 30, 60 seconds"})
				return
			}
			device.PollingInterval = *req.PollingInterval
			cols = append(cols, "polling_interval")
		}

		if len(cols) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no fields to update"})
			return
		}

		if _, err := engine.ID(id).Cols(cols...).Update(&device); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, device)
	}
}

// RefreshAllDevices refreshes status and battery info for all devices
func RefreshAllDevices(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var devices []models.Device
		if err := engine.Find(&devices); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Refresh each device in parallel
		results := make(chan struct {
			id      int64
			success bool
		}, len(devices))

		for _, device := range devices {
			go func(d models.Device) {
				success := refreshDeviceStatus(engine, &d)
				results <- struct {
					id      int64
					success bool
				}{d.ID, success}
			}(device)
		}

		// Wait for all goroutines to complete
		successCount := 0
		for range devices {
			result := <-results
			if result.success {
				successCount++
			}
		}

		// Fetch updated devices
		var updatedDevices []models.Device
		if err := engine.Find(&updatedDevices); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":        updatedDevices,
			"refreshed":    len(devices),
			"online_count": successCount,
		})
	}
}

// refreshDeviceStatus queries device config and battery, updates database
func refreshDeviceStatus(engine *xorm.Engine, device *models.Device) bool {
	client := phoneclient.NewClient(device)

	// Query config to check if device is online
	config, err := client.QueryConfig()
	if err != nil {
		// Device is offline
		device.Status = "offline"
		engine.ID(device.ID).Cols("status").Update(device)
		return false
	}

	// Device is online
	device.Status = "online"
	device.DeviceMark = config.ExtraDeviceMark
	device.ExtraSim1 = config.ExtraSim1
	device.ExtraSim2 = config.ExtraSim2
	device.LastSeen = time.Now()

	// Query battery if enabled
	if config.EnableAPIBatteryQuery {
		battery, err := client.QueryBattery()
		if err == nil {
			device.BatteryLevel = battery.Level
			device.BatteryStatus = battery.Status
			device.BatteryPlugged = battery.Plugged
		}
	}

	// Update device
	engine.ID(device.ID).Cols(
		"status", "device_mark", "extra_sim1", "extra_sim2", "last_seen",
		"battery_level", "battery_status", "battery_plugged",
	).Update(device)

	return true
}
