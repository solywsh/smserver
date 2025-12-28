package repository

import (
	"backend/internal/models"

	"xorm.io/xorm"
)

// SmsRepository handles SMS data access.
type SmsRepository struct {
	engine *xorm.Engine
}

// NewSmsRepository creates a new SmsRepository.
func NewSmsRepository(engine *xorm.Engine) *SmsRepository {
	return &SmsRepository{engine: engine}
}

// Exists checks if an SMS record exists by unique key (excluding soft-deleted records).
func (r *SmsRepository) Exists(deviceID int64, address string, smsTime int64, smsType int) (bool, error) {
	// XORM's 'deleted' tag automatically filters out soft-deleted records
	return r.engine.Where("device_id = ? AND address = ? AND sms_time = ? AND type = ?",
		deviceID, address, smsTime, smsType).Exist(&models.SmsMessage{})
}

// ExistsIncludingDeleted checks if an SMS record exists by unique key, including soft-deleted records.
// This is critical for sync: if a record was soft-deleted, we should not re-sync it.
func (r *SmsRepository) ExistsIncludingDeleted(deviceID int64, address string, smsTime int64, smsType int) (bool, error) {
	// Use Unscoped() to include soft-deleted records in the check
	return r.engine.Unscoped().Where("device_id = ? AND address = ? AND sms_time = ? AND type = ?",
		deviceID, address, smsTime, smsType).Exist(&models.SmsMessage{})
}

// Insert inserts a single SMS record.
func (r *SmsRepository) Insert(sms *models.SmsMessage) error {
	_, err := r.engine.Insert(sms)
	return err
}

// InsertBatch inserts multiple SMS records.
func (r *SmsRepository) InsertBatch(smsList []*models.SmsMessage) (int64, error) {
	if len(smsList) == 0 {
		return 0, nil
	}
	return r.engine.Insert(&smsList)
}

// SmsWithContactName represents an SMS message with contact name from contact list.
type SmsWithContactName struct {
	models.SmsMessage `xorm:"extends"`
	ContactName       string `json:"contact_name"` // Name from contact list (overrides SmsMessage.Name)
}

// FindByDevice returns SMS messages for a device with pagination.
// smsType: 0=all, 1=received, 2=sent
// Uses contact name from contact list if available, otherwise falls back to SMS.Name or "Unknown Number".
func (r *SmsRepository) FindByDevice(deviceID int64, smsType, page, pageSize int, keyword string) ([]SmsWithContactName, int64, error) {
	var items []SmsWithContactName

	// Count query
	countSession := r.engine.Table("sms_message").Where("device_id = ?", deviceID)
	if smsType > 0 {
		countSession = countSession.And("type = ?", smsType)
	}
	if keyword != "" {
		// Search in both SMS name/address/body and contact name
		countSession = countSession.And("(address LIKE ? OR name LIKE ? OR body LIKE ?)",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	// Get total count
	total, err := countSession.Count(&models.SmsMessage{})
	if err != nil {
		return nil, 0, err
	}

	// Data query with LEFT JOIN to contact table
	session := r.engine.Table("sms_message").
		Join("LEFT", "contact", "sms_message.device_id = contact.device_id AND sms_message.address = contact.phone").
		Select("sms_message.*, COALESCE(contact.name, sms_message.name, 'Unknown Number') as contact_name").
		Where("sms_message.device_id = ?", deviceID)

	if smsType > 0 {
		session = session.And("sms_message.type = ?", smsType)
	}
	if keyword != "" {
		// Search in both SMS name/address/body and contact name
		session = session.And("(sms_message.address LIKE ? OR sms_message.name LIKE ? OR sms_message.body LIKE ? OR contact.name LIKE ?)",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	// Apply pagination and ordering
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	err = session.Desc("sms_message.sms_time").Limit(pageSize, offset).Find(&items)
	if err != nil {
		return nil, 0, err
	}

	// Update the Name field in each item to use ContactName
	for i := range items {
		items[i].Name = items[i].ContactName
	}

	return items, total, nil
}

// GetLatestSmsTime returns the latest SMS timestamp for a device.
func (r *SmsRepository) GetLatestSmsTime(deviceID int64, smsType int) (int64, error) {
	var sms models.SmsMessage
	session := r.engine.Where("device_id = ?", deviceID)
	if smsType > 0 {
		session = session.And("type = ?", smsType)
	}
	has, err := session.Desc("sms_time").Get(&sms)
	if err != nil {
		return 0, err
	}
	if !has {
		return 0, nil
	}
	return sms.SmsTime, nil
}

// SmsWithDevice represents an SMS message with device info and contact name.
type SmsWithDevice struct {
	models.SmsMessage `xorm:"extends"`
	DeviceName        string `xorm:"'device_name'" json:"device_name"`
	ContactName       string `json:"contact_name"` // Name from contact list (overrides SmsMessage.Name)
}

// FindAll returns SMS messages from all devices with pagination.
// smsType: 0=all, 1=received, 2=sent
// Uses contact name from contact list if available, otherwise falls back to SMS.Name or "Unknown Number".
func (r *SmsRepository) FindAll(smsType, page, pageSize int, keyword string, deviceID int64) ([]SmsWithDevice, int64, error) {
	var items []SmsWithDevice

	// Build count query
	countSession := r.engine.Table("sms_message")
	if deviceID > 0 {
		countSession = countSession.Where("device_id = ?", deviceID)
	}
	if smsType > 0 {
		countSession = countSession.And("type = ?", smsType)
	}
	if keyword != "" {
		countSession = countSession.And("(address LIKE ? OR name LIKE ? OR body LIKE ?)",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	// Get total count
	total, err := countSession.Count(&models.SmsMessage{})
	if err != nil {
		return nil, 0, err
	}

	// Build data query with JOINs (device and contact)
	session := r.engine.Table("sms_message").
		Join("LEFT", "device", "sms_message.device_id = device.id").
		Join("LEFT", "contact", "sms_message.device_id = contact.device_id AND sms_message.address = contact.phone").
		Select("sms_message.*, device.name as device_name, COALESCE(contact.name, sms_message.name, 'Unknown Number') as contact_name")

	if deviceID > 0 {
		session = session.Where("sms_message.device_id = ?", deviceID)
	}
	if smsType > 0 {
		session = session.And("sms_message.type = ?", smsType)
	}
	if keyword != "" {
		session = session.And("(sms_message.address LIKE ? OR sms_message.name LIKE ? OR sms_message.body LIKE ? OR contact.name LIKE ?)",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	// Apply pagination and ordering
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	err = session.Desc("sms_message.sms_time").Limit(pageSize, offset).Find(&items)
	if err != nil {
		return nil, 0, err
	}

	// Update the Name field in each item to use ContactName
	for i := range items {
		items[i].Name = items[i].ContactName
	}

	return items, total, nil
}

// MarkAsRead marks a single SMS as read.
func (r *SmsRepository) MarkAsRead(id int64) error {
	_, err := r.engine.ID(id).Cols("is_read").Update(&models.SmsMessage{IsRead: true})
	return err
}

// MarkMultipleAsRead marks multiple SMS messages as read.
func (r *SmsRepository) MarkMultipleAsRead(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.engine.In("id", ids).Cols("is_read").Update(&models.SmsMessage{IsRead: true})
	return err
}

// MarkAllAsRead marks all SMS messages as read for a device (optionally filtered by type).
func (r *SmsRepository) MarkAllAsRead(deviceID int64, smsType int) error {
	session := r.engine.Where("device_id = ?", deviceID)
	if smsType > 0 {
		session = session.And("type = ?", smsType)
	}
	_, err := session.Cols("is_read").Update(&models.SmsMessage{IsRead: true})
	return err
}

// Delete deletes a single SMS message by ID.
func (r *SmsRepository) Delete(id int64) error {
	_, err := r.engine.ID(id).Delete(&models.SmsMessage{})
	return err
}

// DeleteBatch deletes multiple SMS messages by IDs.
func (r *SmsRepository) DeleteBatch(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.engine.In("id", ids).Delete(&models.SmsMessage{})
	return err
}
