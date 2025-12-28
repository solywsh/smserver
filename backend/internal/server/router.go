package server

import (
	"backend/config"
	"backend/internal/handlers"

	"github.com/gin-gonic/gin"
	"xorm.io/xorm"
)

// NewRouter wires gin routes with handlers.
// Architecture: SMServer acts as client, phone (SmsForwarder) acts as server.
// SMServer directly calls phone's HTTP API to query/control the phone.
func NewRouter(cfg *config.Config, engine *xorm.Engine) *gin.Engine {
	// Use gin.New() instead of gin.Default() to disable request logging
	r := gin.New()
	r.Use(gin.Recovery()) // Add recovery middleware only
	r.Use(CORSMiddleware(cfg))

	r.GET("/api/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.POST("/api/login", handlers.Login(cfg, engine))

	api := r.Group("/api")
	api.Use(AuthMiddleware(cfg))
	{
		// User profile
		api.GET("/profile", handlers.Profile(engine))
		api.POST("/users/password", handlers.UpdatePassword(engine))

		// All devices SMS and Calls
		api.GET("/sms", handlers.QueryAllSms(engine))
		api.POST("/sms/:id/read", handlers.MarkSmsAsRead(engine))
		api.POST("/sms/mark-read-all", handlers.MarkAllSmsAsReadGlobally(engine)) // Mark all SMS as read (globally)
		api.DELETE("/sms/:id", handlers.DeleteSms(engine))
		api.POST("/sms/delete", handlers.DeleteMultipleSms(engine))
		api.GET("/calls", handlers.QueryAllCalls(engine))
		api.POST("/calls/:id/read", handlers.MarkCallAsRead(engine))
		api.DELETE("/calls/:id", handlers.DeleteCall(engine))
		api.POST("/calls/delete", handlers.DeleteMultipleCalls(engine))

		// Device management
		api.GET("/devices", handlers.ListDevices(engine))
		api.POST("/devices", handlers.CreateDevice(engine))
		api.POST("/devices/refresh", handlers.RefreshAllDevices(engine))
		api.GET("/devices/:id", handlers.DeviceDetail(engine))
		api.PUT("/devices/:id", handlers.UpdateDevice(engine))
		api.DELETE("/devices/:id", handlers.DeleteDevice(engine))

		// Phone control - direct calls to phone's SmsForwarder API
		// Query phone configuration (test connection)
		api.GET("/devices/:id/config", handlers.QueryConfig(engine))

		// SMS operations
		api.GET("/devices/:id/sms", handlers.QuerySms(engine))                    // Query SMS from database with sync
		api.POST("/devices/:id/sms/send", handlers.SendSMS(engine))               // Send SMS via phone
		api.POST("/devices/:id/sms/sync", handlers.SyncSms(engine))               // Manual sync SMS from phone
		api.POST("/devices/:id/sms/mark-read", handlers.MarkAllSmsAsRead(engine)) // Mark all SMS as read

		// Call logs
		api.GET("/devices/:id/calls", handlers.QueryCalls(engine))                    // Query calls from database with sync
		api.POST("/devices/:id/calls/sync", handlers.SyncCalls(engine))               // Manual sync calls from phone
		api.POST("/devices/:id/calls/mark-read", handlers.MarkAllCallsAsRead(engine)) // Mark all calls as read

		// Contacts
		api.GET("/devices/:id/contacts", handlers.QueryContacts(engine))      // Query contacts from database with sync
		api.POST("/devices/:id/contacts/add", handlers.AddContact(engine))    // Add contact to phone
		api.POST("/devices/:id/contacts/sync", handlers.SyncContacts(engine)) // Manual sync contacts from phone

		// Battery and location
		api.GET("/devices/:id/battery", handlers.QueryBattery(engine))   // Query battery status
		api.GET("/devices/:id/location", handlers.QueryLocation(engine)) // Query location

		// Wake-on-LAN
		api.POST("/devices/:id/wol", handlers.WakeOnLan(engine)) // Send WOL packet via phone

		// Clone configuration (一键换新机)
		api.POST("/devices/:id/clone/pull", handlers.ClonePull(engine)) // Pull config from phone
		api.POST("/devices/:id/clone/push", handlers.ClonePush(engine)) // Push config to phone
	}
	return r
}
