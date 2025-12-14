package handlers

import (
	"net/http"
	"strconv"

	"backend/internal/models"
	"backend/internal/phoneclient"

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

// QuerySms queries SMS messages via phone's SmsForwarder API
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
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
		keyword := c.Query("keyword")

		// Call phone API directly
		client := phoneclient.NewClient(device)
		items, err := client.QuerySms(phoneclient.SmsQueryRequest{
			Type:     smsType,
			PageNum:  pageNum,
			PageSize: pageSize,
			Keyword:  keyword,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

// QueryCalls queries call logs via phone's SmsForwarder API
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
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
		phoneNumber := c.Query("phone_number")

		// Call phone API directly
		client := phoneclient.NewClient(device)
		items, err := client.QueryCalls(phoneclient.CallQueryRequest{
			Type:        callType,
			PageNum:     pageNum,
			PageSize:    pageSize,
			PhoneNumber: phoneNumber,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

// QueryContacts queries contacts via phone's SmsForwarder API
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
		phoneNumber := c.Query("phone_number")
		name := c.Query("name")

		// Call phone API directly
		client := phoneclient.NewClient(device)
		items, err := client.QueryContacts(phoneclient.ContactQueryRequest{
			PhoneNumber: phoneNumber,
			Name:        name,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"items": items})
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
		engine.ID(device.ID).Cols("device_mark", "extra_sim1", "extra_sim2", "status", "last_seen").Update(device)

		c.JSON(http.StatusOK, config)
	}
}

// Helper function to parse device ID
func parseID(s string) int64 {
	id, _ := strconv.ParseInt(s, 10, 64)
	return id
}
