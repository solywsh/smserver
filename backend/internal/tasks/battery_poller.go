package tasks

import (
	"log"
	"time"

	"backend/internal/models"
	"backend/internal/phoneclient"

	"xorm.io/xorm"
)

// BatteryPoller periodically queries battery status from all devices
type BatteryPoller struct {
	engine   *xorm.Engine
	interval time.Duration
	stopCh   chan struct{}
}

// NewBatteryPoller creates a new battery poller
func NewBatteryPoller(engine *xorm.Engine, interval time.Duration) *BatteryPoller {
	return &BatteryPoller{
		engine:   engine,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the periodic battery polling
func (bp *BatteryPoller) Start() {
	log.Printf("Starting battery poller with interval %v", bp.interval)
	go bp.run()
}

// Stop stops the battery poller
func (bp *BatteryPoller) Stop() {
	close(bp.stopCh)
}

func (bp *BatteryPoller) run() {
	// Poll immediately on start
	bp.pollAllDevices()

	ticker := time.NewTicker(bp.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			bp.pollAllDevices()
		case <-bp.stopCh:
			log.Println("Battery poller stopped")
			return
		}
	}
}

func (bp *BatteryPoller) pollAllDevices() {
	var devices []models.Device
	if err := bp.engine.Find(&devices); err != nil {
		log.Printf("Failed to fetch devices for battery polling: %v", err)
		return
	}

	for _, device := range devices {
		go bp.pollDevice(&device)
	}
}

func (bp *BatteryPoller) pollDevice(device *models.Device) {
	client := phoneclient.NewClient(device)

	// First try to query config to check if device is online
	config, err := client.QueryConfig()
	if err != nil {
		// Device is offline
		if device.Status != "offline" {
			device.Status = "offline"
			bp.engine.ID(device.ID).Cols("status").Update(device)
		}
		return
	}

	// Device is online, update device info
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
	bp.engine.ID(device.ID).Cols(
		"status", "device_mark", "extra_sim1", "extra_sim2", "last_seen",
		"battery_level", "battery_status", "battery_plugged",
	).Update(device)
}
