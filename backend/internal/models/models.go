package models

import (
	"time"
)

// User represents an admin user for the web panel.
type User struct {
	ID        int64     `xorm:"pk autoincr 'id'" json:"id"`
	Username  string    `xorm:"unique notnull 'username'" json:"username"`
	Password  string    `xorm:"varchar(255) notnull 'password'" json:"-"`
	CreatedAt time.Time `xorm:"created" json:"created_at"`
	UpdatedAt time.Time `xorm:"updated" json:"updated_at"`
}

// Device represents a client device (phone running SmsForwarder).
// SMServer acts as client, phone acts as server.
// PhoneAddr: phone's HTTP server address (e.g., "http://192.168.1.100:5000" or "http://smsf.demo.com")
// SM4Key: user-provided SM4 encryption key from phone's SmsForwarder settings
type Device struct {
	ID             int64     `xorm:"pk autoincr 'id'" json:"id"`
	Name           string    `xorm:"varchar(100) notnull 'name'" json:"name"`
	PhoneAddr      string    `xorm:"varchar(255) notnull 'phone_addr'" json:"phone_addr"`  // Phone HTTP server address
	SM4Key         string    `xorm:"varchar(64) notnull 'sm4_key'" json:"sm4_key"`         // User-provided SM4 key (32 hex chars)
	Status         string    `xorm:"varchar(32) 'status'" json:"status"`                   // online, offline
	Battery        int       `xorm:"int 'battery'" json:"battery"`                         // Deprecated: use BatteryLevel
	BatteryLevel   string    `xorm:"varchar(10) 'battery_level'" json:"battery_level"`     // e.g., "85%"
	BatteryStatus  string    `xorm:"varchar(50) 'battery_status'" json:"battery_status"`   // e.g., "充电中", "未充电"
	BatteryPlugged string    `xorm:"varchar(20) 'battery_plugged'" json:"battery_plugged"` // e.g., "AC", "USB", "无"
	Latitude       float64   `xorm:"double 'latitude'" json:"latitude"`
	Longitude      float64   `xorm:"double 'longitude'" json:"longitude"`
	SimInfo        string    `xorm:"text 'sim_info'" json:"sim_info"`
	DeviceMark     string    `xorm:"varchar(255) 'device_mark'" json:"device_mark"` // Extra device mark from SmsForwarder
	ExtraSim1      string    `xorm:"varchar(255) 'extra_sim1'" json:"extra_sim1"`   // SIM1 info
	ExtraSim2      string    `xorm:"varchar(255) 'extra_sim2'" json:"extra_sim2"`   // SIM2 info
	LastSeen       time.Time `xorm:"'last_seen'" json:"last_seen"`
	Remark         string    `xorm:"varchar(255) 'remark'" json:"remark"`
	CreatedAt      time.Time `xorm:"created" json:"created_at"`
}

// SmsMessage stores SMS history per device.
// Unique constraint: (device_id, address, sms_time, type)
type SmsMessage struct {
	ID        int64     `xorm:"pk autoincr 'id'" json:"id"`
	DeviceID  int64     `xorm:"index notnull 'device_id'" json:"device_id"`
	Address   string    `xorm:"varchar(100) 'address'" json:"address"` // Phone number
	Name      string    `xorm:"varchar(100) 'name'" json:"name"`       // Contact name
	Body      string    `xorm:"text 'body'" json:"body"`               // SMS content
	Type      int       `xorm:"int 'type'" json:"type"`                // 1=received, 2=sent
	SimID     int       `xorm:"int 'sim_id'" json:"sim_id"`            // 0=SIM1, 1=SIM2, -1=unknown
	SmsTime   int64     `xorm:"bigint 'sms_time'" json:"sms_time"`     // Timestamp in milliseconds
	CreatedAt time.Time `xorm:"created" json:"created_at"`
}

// CallLog stores call history.
// Unique constraint: (device_id, number, call_time, type)
type CallLog struct {
	ID        int64     `xorm:"pk autoincr 'id'" json:"id"`
	DeviceID  int64     `xorm:"index notnull 'device_id'" json:"device_id"`
	Number    string    `xorm:"varchar(40) 'number'" json:"number"`
	Name      string    `xorm:"varchar(100) 'name'" json:"name"`
	Type      int       `xorm:"int 'type'" json:"type"`              // 1=incoming, 2=outgoing, 3=missed
	Duration  int       `xorm:"int 'duration'" json:"duration"`      // Duration in seconds
	SimID     int       `xorm:"int 'sim_id'" json:"sim_id"`          // 0=SIM1, 1=SIM2, -1=unknown
	CallTime  int64     `xorm:"bigint 'call_time'" json:"call_time"` // Timestamp in milliseconds
	CreatedAt time.Time `xorm:"created" json:"created_at"`
}

// Contact represents a device contact entry.
// Unique constraint: (device_id, phone)
type Contact struct {
	ID        int64     `xorm:"pk autoincr 'id'" json:"id"`
	DeviceID  int64     `xorm:"index notnull 'device_id'" json:"device_id"`
	Name      string    `xorm:"varchar(100) 'name'" json:"name"`
	Phone     string    `xorm:"varchar(40) 'phone'" json:"phone"`
	Email     string    `xorm:"varchar(120) 'email'" json:"email,omitempty"`
	Note      string    `xorm:"varchar(255) 'note'" json:"note,omitempty"`
	CreatedAt time.Time `xorm:"created" json:"created_at"`
}

// Command represents a task server asks device to execute.
type Command struct {
	ID        int64     `xorm:"pk autoincr 'id'" json:"id"`
	DeviceID  int64     `xorm:"index notnull 'device_id'" json:"device_id"`
	Type      string    `xorm:"varchar(40) 'type'" json:"type"`
	Payload   string    `xorm:"text 'payload'" json:"payload"`
	Status    string    `xorm:"varchar(20) 'status'" json:"status"` // pending, sent, done, failed
	Result    string    `xorm:"text 'result'" json:"result"`
	CreatedAt time.Time `xorm:"created" json:"created_at"`
	UpdatedAt time.Time `xorm:"updated" json:"updated_at"`
}
