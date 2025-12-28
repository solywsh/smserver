package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"
	"backend/internal/phoneclient"
	"backend/internal/repository"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
	"xorm.io/xorm"
)

// getDevice fetches a device by ID from the database
func getDevice(engine *xorm.Engine, idStr string) (*models.Device, error) {
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return nil, err
	}

	var device models.Device
	has, err := engine.ID(id).Get(&device)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, nil
	}
	return &device, nil
}

// SendSMS sends SMS via phone's SmsForwarder API
func SendSMS(engine *xorm.Engine) gin.HandlerFunc {
	type sendRequest struct {
		SimSlot      int    `json:"sim_slot" binding:"required"` // 1=SIM1, 2=SIM2
		PhoneNumbers string `json:"phone_numbers" binding:"required"`
		MsgContent   string `json:"msg_content" binding:"required"`
	}

	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		var req sendRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Call phone API directly
		client := phoneclient.NewClient(device)
		err = client.SendSms(phoneclient.SmsSendRequest{
			SimSlot:      req.SimSlot,
			PhoneNumbers: req.PhoneNumbers,
			MsgContent:   req.MsgContent,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// After successful send, sync the sent message to avoid duplicate sync later
		// Query recent sent messages (type=2) from phone
		go func() {
			// Use goroutine to avoid blocking the response
			time.Sleep(1 * time.Second) // Wait 1 second for phone to save the message

			items, err := client.QuerySms(phoneclient.SmsQueryRequest{
				Type:     2, // Sent messages
				PageNum:  1,
				PageSize: 20, // Get recent 20 sent messages
			})
			if err != nil {
				log.Printf("[SendSMS] failed to query sent messages after send: %v", err)
				return
			}

			// Find matching message(s) by content and address
			// Split phone numbers in case multiple were sent
			phoneNumbers := strings.Split(req.PhoneNumbers, ";")
			repo := repository.NewSmsRepository(engine)
			contactRepo := repository.NewContactRepository(engine)

			for _, phoneNum := range phoneNumbers {
				phoneNum = strings.TrimSpace(phoneNum)
				if phoneNum == "" {
					continue
				}

				// Find the matching sent message
				for _, item := range items {
					if item.Number == phoneNum && item.Content == req.MsgContent && item.Type == 2 {
						// Check if already exists
						exists, err := repo.ExistsIncludingDeleted(device.ID, item.Number, item.Date, item.Type)
						if err != nil {
							log.Printf("[SendSMS] check exists error: %v", err)
							continue
						}

						if !exists {
							// Ensure hidden contact exists
							_, err := contactRepo.EnsureHiddenContact(device.ID, item.Number, item.Name)
							if err != nil {
								log.Printf("[SendSMS] ensure hidden contact error: %v", err)
							}

							// Save to database with is_read=true (since user just sent it)
							sms := &models.SmsMessage{
								DeviceID: device.ID,
								Address:  item.Number,
								Name:     item.Name,
								Body:     item.Content,
								Type:     item.Type,
								SimID:    item.SimID,
								SmsTime:  item.Date,
								IsRead:   true, // Mark as read since user sent it
							}

							err = repo.Insert(sms)
							if err != nil {
								log.Printf("[SendSMS] failed to insert sent message: %v", err)
							} else {
								log.Printf("[SendSMS] saved sent message to database: %s -> %s", device.Name, phoneNum)
							}
						}
						break // Found the matching message
					}
				}
			}
		}()

		c.JSON(http.StatusOK, gin.H{"message": "SMS sent successfully"})
	}
}

// AddContact adds a contact via phone's SmsForwarder API
func AddContact(engine *xorm.Engine) gin.HandlerFunc {
	type addRequest struct {
		Name        string `json:"name" binding:"required"`
		PhoneNumber string `json:"phone_number" binding:"required"` // Semicolon-separated phone numbers
	}

	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		var req addRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Call phone API directly
		client := phoneclient.NewClient(device)
		err = client.AddContact(phoneclient.ContactAddRequest{
			Name:        req.Name,
			PhoneNumber: req.PhoneNumber,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Contact added successfully"})
	}
}

// WakeOnLan sends WOL packet via phone's SmsForwarder API
func WakeOnLan(engine *xorm.Engine) gin.HandlerFunc {
	type wolRequest struct {
		Mac  string `json:"mac" binding:"required"`
		IP   string `json:"ip,omitempty"`
		Port int    `json:"port,omitempty"`
	}

	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		var req wolRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Call phone API directly
		client := phoneclient.NewClient(device)
		err = client.SendWol(phoneclient.WolRequest{
			Mac:  req.Mac,
			IP:   req.IP,
			Port: req.Port,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "WOL packet sent successfully"})
	}
}

// QueryBattery queries battery status via phone's SmsForwarder API
func QueryBattery(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		// Call phone API directly
		client := phoneclient.NewClient(device)
		battery, err := client.QueryBattery()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, battery)
	}
}

// QuerySms queries SMS messages from local database with background sync
func QuerySms(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		// Parse query parameters
		smsType, _ := strconv.Atoi(c.DefaultQuery("type", "0"))
		pageNum, _ := strconv.Atoi(c.DefaultQuery("page_num", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
		keyword := c.Query("keyword")
		forceSync := c.Query("sync") == "true"

		// Trigger sync
		syncService := services.NewSyncService(engine)
		var syncResult *services.SyncResult
		if forceSync {
			// Blocking sync
			syncResult, _ = syncService.SyncSms(device, smsType)
		} else {
			// Background sync
			go syncService.SyncSms(device, smsType)
		}

		// Query from database
		repo := repository.NewSmsRepository(engine)
		items, total, err := repo.FindByDevice(device.ID, smsType, pageNum, pageSize, keyword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		response := gin.H{
			"items": items,
			"total": total,
			"page":  pageNum,
			"size":  pageSize,
		}
		if syncResult != nil {
			response["sync"] = syncResult
		}

		c.JSON(http.StatusOK, response)
	}
}

// QueryCalls queries call logs from local database with background sync
func QueryCalls(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		// Parse query parameters
		callType, _ := strconv.Atoi(c.DefaultQuery("type", "0"))
		pageNum, _ := strconv.Atoi(c.DefaultQuery("page_num", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
		phoneNumber := c.Query("phone_number")
		forceSync := c.Query("sync") == "true"

		// Trigger sync
		syncService := services.NewSyncService(engine)
		var syncResult *services.SyncResult
		if forceSync {
			// Blocking sync
			syncResult, _ = syncService.SyncCalls(device, callType)
		} else {
			// Background sync
			go syncService.SyncCalls(device, callType)
		}

		// Query from database
		repo := repository.NewCallRepository(engine)
		items, total, err := repo.FindByDevice(device.ID, callType, pageNum, pageSize, phoneNumber)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		response := gin.H{
			"items": items,
			"total": total,
			"page":  pageNum,
			"size":  pageSize,
		}
		if syncResult != nil {
			response["sync"] = syncResult
		}

		c.JSON(http.StatusOK, response)
	}
}

// QueryContacts queries contacts from local database with background sync
func QueryContacts(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		// Parse query parameters
		keyword := c.Query("keyword")
		forceSync := c.Query("sync") == "true"

		// Trigger sync
		syncService := services.NewSyncService(engine)
		var syncResult *services.SyncResult
		if forceSync {
			// Blocking sync
			syncResult, _ = syncService.SyncContacts(device)
		} else {
			// Background sync
			go syncService.SyncContacts(device)
		}

		// Query from database
		repo := repository.NewContactRepository(engine)
		items, total, err := repo.FindByDevice(device.ID, keyword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		response := gin.H{
			"items": items,
			"total": total,
		}
		if syncResult != nil {
			response["sync"] = syncResult
		}

		c.JSON(http.StatusOK, response)
	}
}

// QueryLocation queries phone location via SmsForwarder API
func QueryLocation(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		// Call phone API directly
		client := phoneclient.NewClient(device)
		location, err := client.QueryLocation()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, location)
	}
}

// QueryConfig queries phone configuration via SmsForwarder API
// This can be used to test connection and see enabled features
func QueryConfig(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		// Call phone API directly
		client := phoneclient.NewClient(device)
		config, err := client.QueryConfig()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Update device info from config
		device.DeviceMark = config.ExtraDeviceMark
		device.ExtraSim1 = config.ExtraSim1
		device.ExtraSim2 = config.ExtraSim2
		device.Status = "online"

		// Query battery if enabled
		if config.EnableAPIBatteryQuery {
			battery, err := client.QueryBattery()
			if err == nil {
				device.BatteryLevel = battery.Level
				device.BatteryStatus = battery.Status
				device.BatteryPlugged = battery.Plugged
			}
		}

		// Update device with all info including battery
		engine.ID(device.ID).Cols(
			"device_mark", "extra_sim1", "extra_sim2", "status", "last_seen",
			"battery_level", "battery_status", "battery_plugged",
		).Update(device)

		c.JSON(http.StatusOK, config)
	}
}

// Helper function to parse device ID
func parseID(s string) int64 {
	id, _ := strconv.ParseInt(s, 10, 64)
	return id
}

// ClonePull pulls configuration from phone via SmsForwarder API
func ClonePull(engine *xorm.Engine) gin.HandlerFunc {
	type pullRequest struct {
		VersionCode int `json:"version_code"` // App version code
	}

	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		var req pullRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Call phone API directly
		client := phoneclient.NewClient(device)
		config, err := client.ClonePull(req.VersionCode)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, config)
	}
}

// ClonePush pushes configuration to phone via SmsForwarder API
func ClonePush(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		// Parse the config from request body
		var config phoneclient.CloneConfig
		if err := c.ShouldBindJSON(&config); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Call phone API directly
		client := phoneclient.NewClient(device)
		err = client.ClonePush(config)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Configuration pushed successfully"})
	}
}

// SyncSms manually triggers SMS sync from phone
func SyncSms(engine *xorm.Engine) gin.HandlerFunc {
	type syncRequest struct {
		Type int `json:"type"` // 0=all, 1=received, 2=sent
	}

	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		var req syncRequest
		c.ShouldBindJSON(&req) // Optional, defaults to 0

		syncService := services.NewSyncService(engine)
		result, err := syncService.SyncSms(device, req.Type)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

// SyncCalls manually triggers call log sync from phone
func SyncCalls(engine *xorm.Engine) gin.HandlerFunc {
	type syncRequest struct {
		Type int `json:"type"` // 0=all, 1=incoming, 2=outgoing, 3=missed
	}

	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		var req syncRequest
		c.ShouldBindJSON(&req) // Optional, defaults to 0

		syncService := services.NewSyncService(engine)
		result, err := syncService.SyncCalls(device, req.Type)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

// SyncContacts manually triggers contact sync from phone
func SyncContacts(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		syncService := services.NewSyncService(engine)
		result, err := syncService.SyncContacts(device)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

// QueryAllSms queries SMS messages from all devices with pagination
func QueryAllSms(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse query parameters
		smsType, _ := strconv.Atoi(c.DefaultQuery("type", "0"))
		pageNum, _ := strconv.Atoi(c.DefaultQuery("page_num", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
		keyword := c.Query("keyword")
		deviceID, _ := strconv.ParseInt(c.Query("device_id"), 10, 64)

		// Query from database
		repo := repository.NewSmsRepository(engine)
		items, total, err := repo.FindAll(smsType, pageNum, pageSize, keyword, deviceID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Get unread count with same filters
		unreadCount, err := repo.CountUnread(smsType, deviceID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":        items,
			"total":        total,
			"unread_count": unreadCount,
			"page":         pageNum,
			"size":         pageSize,
		})
	}
}

// QueryAllCalls queries call logs from all devices with pagination
func QueryAllCalls(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse query parameters
		callType, _ := strconv.Atoi(c.DefaultQuery("type", "0"))
		pageNum, _ := strconv.Atoi(c.DefaultQuery("page_num", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
		phoneNumber := c.Query("phone_number")
		deviceID, _ := strconv.ParseInt(c.Query("device_id"), 10, 64)

		// Query from database
		repo := repository.NewCallRepository(engine)
		items, total, err := repo.FindAll(callType, pageNum, pageSize, phoneNumber, deviceID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items": items,
			"total": total,
			"page":  pageNum,
			"size":  pageSize,
		})
	}
}

// MarkSmsAsRead marks a single SMS as read
func MarkSmsAsRead(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid SMS id"})
			return
		}

		repo := repository.NewSmsRepository(engine)
		if err := repo.MarkAsRead(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SMS marked as read"})
	}
}

// MarkAllSmsAsRead marks all SMS messages as read for a device
func MarkAllSmsAsRead(engine *xorm.Engine) gin.HandlerFunc {
	type markRequest struct {
		Type int `json:"type"` // 0=all, 1=received, 2=sent
	}

	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		var req markRequest
		c.ShouldBindJSON(&req) // Optional, defaults to 0 (all)

		repo := repository.NewSmsRepository(engine)
		if err := repo.MarkAllAsRead(device.ID, req.Type); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "All SMS marked as read"})
	}
}

// MarkCallAsRead marks a single call log as read
func MarkCallAsRead(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid call id"})
			return
		}

		repo := repository.NewCallRepository(engine)
		if err := repo.MarkAsRead(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Call marked as read"})
	}
}

// MarkAllCallsAsRead marks all call logs as read for a device
func MarkAllCallsAsRead(engine *xorm.Engine) gin.HandlerFunc {
	type markRequest struct {
		Type int `json:"type"` // 0=all, 1=incoming, 2=outgoing, 3=missed
	}

	return func(c *gin.Context) {
		deviceID := c.Param("id")
		device, err := getDevice(engine, deviceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
			return
		}
		if device == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}

		var req markRequest
		c.ShouldBindJSON(&req) // Optional, defaults to 0 (all)

		repo := repository.NewCallRepository(engine)
		if err := repo.MarkAllAsRead(device.ID, req.Type); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "All calls marked as read"})
	}
}

// DeleteSms deletes a single SMS message by ID
func DeleteSms(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid SMS id"})
			return
		}

		repo := repository.NewSmsRepository(engine)
		if err := repo.Delete(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SMS deleted successfully"})
	}
}

// DeleteMultipleSms deletes multiple SMS messages by IDs
func DeleteMultipleSms(engine *xorm.Engine) gin.HandlerFunc {
	type deleteRequest struct {
		IDs []int64 `json:"ids" binding:"required"`
	}

	return func(c *gin.Context) {
		var req deleteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		repo := repository.NewSmsRepository(engine)
		if err := repo.DeleteBatch(req.IDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "SMS deleted successfully", "count": len(req.IDs)})
	}
}

// DeleteCall deletes a single call log by ID
func DeleteCall(engine *xorm.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid call id"})
			return
		}

		repo := repository.NewCallRepository(engine)
		if err := repo.Delete(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Call deleted successfully"})
	}
}

// DeleteMultipleCalls deletes multiple call logs by IDs
func DeleteMultipleCalls(engine *xorm.Engine) gin.HandlerFunc {
	type deleteRequest struct {
		IDs []int64 `json:"ids" binding:"required"`
	}

	return func(c *gin.Context) {
		var req deleteRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		repo := repository.NewCallRepository(engine)
		if err := repo.DeleteBatch(req.IDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Calls deleted successfully", "count": len(req.IDs)})
	}
}

// MarkAllSmsAsReadGlobally marks all unread SMS messages as read across all devices
func MarkAllSmsAsReadGlobally(engine *xorm.Engine) gin.HandlerFunc {
	type markRequest struct {
		Type     int   `json:"type"`      // 0=all, 1=received, 2=sent
		DeviceID int64 `json:"device_id"` // 0=all devices
	}

	return func(c *gin.Context) {
		var req markRequest
		c.ShouldBindJSON(&req) // Optional, defaults to 0

		repo := repository.NewSmsRepository(engine)
		if err := repo.MarkAllAsReadGlobally(req.Type, req.DeviceID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "All messages marked as read"})
	}
}
