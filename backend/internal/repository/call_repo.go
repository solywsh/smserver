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

// Exists checks if a call record exists by unique key.
func (r *CallRepository) Exists(deviceID int64, number string, callTime int64, callType int) (bool, error) {
	return r.engine.Where("device_id = ? AND number = ? AND call_time = ? AND type = ?",
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

// FindByDevice returns call logs for a device with pagination.
// callType: 0=all, 1=incoming, 2=outgoing, 3=missed
func (r *CallRepository) FindByDevice(deviceID int64, callType, page, pageSize int, phoneNumber string) ([]models.CallLog, int64, error) {
	var items []models.CallLog

	session := r.engine.Where("device_id = ?", deviceID)

	if callType > 0 {
		session = session.And("type = ?", callType)
	}

	if phoneNumber != "" {
		session = session.And("(number LIKE ? OR name LIKE ?)",
			"%"+phoneNumber+"%", "%"+phoneNumber+"%")
	}

	// Get total count
	total, err := session.Count(&models.CallLog{})
	if err != nil {
		return nil, 0, err
	}

	// Reset session for actual query
	session = r.engine.Where("device_id = ?", deviceID)
	if callType > 0 {
		session = session.And("type = ?", callType)
	}
	if phoneNumber != "" {
		session = session.And("(number LIKE ? OR name LIKE ?)",
			"%"+phoneNumber+"%", "%"+phoneNumber+"%")
	}

	// Apply pagination and ordering
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	err = session.Desc("call_time").Limit(pageSize, offset).Find(&items)
	if err != nil {
		return nil, 0, err
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

// CallWithDevice represents a call log with device info.
type CallWithDevice struct {
	models.CallLog `xorm:"extends"`
	DeviceName     string `xorm:"'device_name'" json:"device_name"`
}

// FindAll returns call logs from all devices with pagination.
// callType: 0=all, 1=incoming, 2=outgoing, 3=missed
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

	// Build data query with JOIN
	session := r.engine.Table("call_log").
		Join("LEFT", "device", "call_log.device_id = device.id").
		Select("call_log.*, device.name as device_name")

	if deviceID > 0 {
		session = session.Where("call_log.device_id = ?", deviceID)
	}
	if callType > 0 {
		session = session.And("call_log.type = ?", callType)
	}
	if phoneNumber != "" {
		session = session.And("(call_log.number LIKE ? OR call_log.name LIKE ?)",
			"%"+phoneNumber+"%", "%"+phoneNumber+"%")
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

	return items, total, nil
}
