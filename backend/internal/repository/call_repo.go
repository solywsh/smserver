package repository

import (
	"backend/internal/models"

	"xorm.io/xorm"
)

// CallRepository handles call log data access.
type CallRepository struct {
	engine *xorm.Engine
}

// NewCallRepository creates a new CallRepository.
func NewCallRepository(engine *xorm.Engine) *CallRepository {
	return &CallRepository{engine: engine}
}

// Exists checks if a call record exists by unique key (excluding soft-deleted records).
func (r *CallRepository) Exists(deviceID int64, number string, callTime int64, callType int) (bool, error) {
	// XORM's 'deleted' tag automatically filters out soft-deleted records
	return r.engine.Where("device_id = ? AND number = ? AND call_time = ? AND type = ?",
		deviceID, number, callTime, callType).Exist(&models.CallLog{})
}

// ExistsIncludingDeleted checks if a call record exists by unique key, including soft-deleted records.
// This is critical for sync: if a record was soft-deleted, we should not re-sync it.
func (r *CallRepository) ExistsIncludingDeleted(deviceID int64, number string, callTime int64, callType int) (bool, error) {
	// Use Unscoped() to include soft-deleted records in the check
	return r.engine.Unscoped().Where("device_id = ? AND number = ? AND call_time = ? AND type = ?",
		deviceID, number, callTime, callType).Exist(&models.CallLog{})
}

// Insert inserts a single call record.
func (r *CallRepository) Insert(call *models.CallLog) error {
	_, err := r.engine.Insert(call)
	return err
}

// InsertBatch inserts multiple call records.
func (r *CallRepository) InsertBatch(calls []*models.CallLog) (int64, error) {
	if len(calls) == 0 {
		return 0, nil
	}
	return r.engine.Insert(&calls)
}

// CallWithContactName represents a call log with contact name from contact list.
type CallWithContactName struct {
	models.CallLog `xorm:"extends"`
	ContactName    string `json:"contact_name"` // Name from contact list (overrides CallLog.Name)
}

// FindByDevice returns call logs for a device with pagination.
// callType: 0=all, 1=incoming, 2=outgoing, 3=missed
// Uses contact name from contact list if available, otherwise falls back to CallLog.Name or "Unknown Number".
func (r *CallRepository) FindByDevice(deviceID int64, callType, page, pageSize int, phoneNumber string) ([]CallWithContactName, int64, error) {
	var items []CallWithContactName

	// Count query
	countSession := r.engine.Table("call_log").Where("device_id = ?", deviceID)
	if callType > 0 {
		countSession = countSession.And("type = ?", callType)
	}
	if phoneNumber != "" {
		// Search in both call log name/number and contact name
		countSession = countSession.And("(number LIKE ? OR name LIKE ?)",
			"%"+phoneNumber+"%", "%"+phoneNumber+"%")
	}

	// Get total count
	total, err := countSession.Count(&models.CallLog{})
	if err != nil {
		return nil, 0, err
	}

	// Data query with LEFT JOIN to contact table
	session := r.engine.Table("call_log").
		Join("LEFT", "contact", "call_log.device_id = contact.device_id AND call_log.number = contact.phone").
		Select("call_log.*, COALESCE(contact.name, call_log.name, 'Unknown Number') as contact_name").
		Where("call_log.device_id = ?", deviceID)

	if callType > 0 {
		session = session.And("call_log.type = ?", callType)
	}
	if phoneNumber != "" {
		// Search in both call log name/number and contact name
		session = session.And("(call_log.number LIKE ? OR call_log.name LIKE ? OR contact.name LIKE ?)",
			"%"+phoneNumber+"%", "%"+phoneNumber+"%", "%"+phoneNumber+"%")
	}

	// Apply pagination and ordering
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	err = session.Desc("call_log.call_time").Limit(pageSize, offset).Find(&items)
	if err != nil {
		return nil, 0, err
	}

	// Update the Name field in each item to use ContactName
	for i := range items {
		items[i].Name = items[i].ContactName
	}

	return items, total, nil
}

// GetLatestCallTime returns the latest call timestamp for a device.
func (r *CallRepository) GetLatestCallTime(deviceID int64, callType int) (int64, error) {
	var call models.CallLog
	session := r.engine.Where("device_id = ?", deviceID)
	if callType > 0 {
		session = session.And("type = ?", callType)
	}
	has, err := session.Desc("call_time").Get(&call)
	if err != nil {
		return 0, err
	}
	if !has {
		return 0, nil
	}
	return call.CallTime, nil
}

// CallWithDevice represents a call log with device info and contact name.
type CallWithDevice struct {
	models.CallLog `xorm:"extends"`
	DeviceName     string `xorm:"'device_name'" json:"device_name"`
	ContactName    string `json:"contact_name"` // Name from contact list (overrides CallLog.Name)
}

// FindAll returns call logs from all devices with pagination.
// callType: 0=all, 1=incoming, 2=outgoing, 3=missed
// Uses contact name from contact list if available, otherwise falls back to CallLog.Name or "Unknown Number".
func (r *CallRepository) FindAll(callType, page, pageSize int, phoneNumber string, deviceID int64) ([]CallWithDevice, int64, error) {
	var items []CallWithDevice

	// Build count query
	countSession := r.engine.Table("call_log")
	if deviceID > 0 {
		countSession = countSession.Where("device_id = ?", deviceID)
	}
	if callType > 0 {
		countSession = countSession.And("type = ?", callType)
	}
	if phoneNumber != "" {
		countSession = countSession.And("(number LIKE ? OR name LIKE ?)",
			"%"+phoneNumber+"%", "%"+phoneNumber+"%")
	}

	// Get total count
	total, err := countSession.Count(&models.CallLog{})
	if err != nil {
		return nil, 0, err
	}

	// Build data query with JOINs (device and contact)
	session := r.engine.Table("call_log").
		Join("LEFT", "device", "call_log.device_id = device.id").
		Join("LEFT", "contact", "call_log.device_id = contact.device_id AND call_log.number = contact.phone").
		Select("call_log.*, device.name as device_name, COALESCE(contact.name, call_log.name, 'Unknown Number') as contact_name")

	if deviceID > 0 {
		session = session.Where("call_log.device_id = ?", deviceID)
	}
	if callType > 0 {
		session = session.And("call_log.type = ?", callType)
	}
	if phoneNumber != "" {
		session = session.And("(call_log.number LIKE ? OR call_log.name LIKE ? OR contact.name LIKE ?)",
			"%"+phoneNumber+"%", "%"+phoneNumber+"%", "%"+phoneNumber+"%")
	}

	// Apply pagination and ordering
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	err = session.Desc("call_log.call_time").Limit(pageSize, offset).Find(&items)
	if err != nil {
		return nil, 0, err
	}

	// Update the Name field in each item to use ContactName
	for i := range items {
		items[i].Name = items[i].ContactName
	}

	return items, total, nil
}

// MarkAsRead marks a single call as read.
func (r *CallRepository) MarkAsRead(id int64) error {
	_, err := r.engine.ID(id).Cols("is_read").Update(&models.CallLog{IsRead: true})
	return err
}

// MarkMultipleAsRead marks multiple call logs as read.
func (r *CallRepository) MarkMultipleAsRead(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.engine.In("id", ids).Cols("is_read").Update(&models.CallLog{IsRead: true})
	return err
}

// MarkAllAsRead marks all call logs as read for a device (optionally filtered by type).
func (r *CallRepository) MarkAllAsRead(deviceID int64, callType int) error {
	session := r.engine.Where("device_id = ?", deviceID)
	if callType > 0 {
		session = session.And("type = ?", callType)
	}
	_, err := session.Cols("is_read").Update(&models.CallLog{IsRead: true})
	return err
}

// Delete deletes a single call log by ID.
func (r *CallRepository) Delete(id int64) error {
	_, err := r.engine.ID(id).Delete(&models.CallLog{})
	return err
}

// DeleteBatch deletes multiple call logs by IDs.
func (r *CallRepository) DeleteBatch(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.engine.In("id", ids).Delete(&models.CallLog{})
	return err
}
