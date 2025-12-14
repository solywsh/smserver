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
	r := gin.Default()
	r.Use(CORSMiddleware(cfg))

	r.GET("/api/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.POST("/api/login", handlers.Login(cfg, engine))

	api := r.Group("/api")
	api.Use(AuthMiddleware(cfg))
	{
		// User profile
		api.GET("/profile", handlers.Profile(engine))
		api.POST("/users/password", handlers.UpdatePassword(engine))

		// Device management
		api.GET("/devices", handlers.ListDevices(engine))
		api.POST("/devices", handlers.CreateDevice(engine))
		api.GET("/devices/:id", handlers.DeviceDetail(engine))
		api.DELETE("/devices/:id", handlers.DeleteDevice(engine))

		// Phone control - direct calls to phone's SmsForwarder API
		// Query phone configuration (test connection)
		api.GET("/devices/:id/config", handlers.QueryConfig(engine))

		// SMS operations
		api.GET("/devices/:id/sms", handlers.QuerySms(engine))      // Query SMS from phone
		api.POST("/devices/:id/sms/send", handlers.SendSMS(engine)) // Send SMS via phone

		// Call logs
		api.GET("/devices/:id/calls", handlers.QueryCalls(engine)) // Query call logs from phone

		// Contacts
		api.GET("/devices/:id/contacts", handlers.QueryContacts(engine))   // Query contacts from phone
		api.POST("/devices/:id/contacts/add", handlers.AddContact(engine)) // Add contact to phone

		// Battery and location
		api.GET("/devices/:id/battery", handlers.QueryBattery(engine))   // Query battery status
		api.GET("/devices/:id/location", handlers.QueryLocation(engine)) // Query location

		// Wake-on-LAN
		api.POST("/devices/:id/wol", handlers.WakeOnLan(engine)) // Send WOL packet via phone
	}
	return r
}
