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

// Exists checks if an SMS record exists by unique key.
func (r *SmsRepository) Exists(deviceID int64, address string, smsTime int64, smsType int) (bool, error) {
	return r.engine.Where("device_id = ? AND address = ? AND sms_time = ? AND type = ?",
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

// FindByDevice returns SMS messages for a device with pagination.
// smsType: 0=all, 1=received, 2=sent
func (r *SmsRepository) FindByDevice(deviceID int64, smsType, page, pageSize int, keyword string) ([]models.SmsMessage, int64, error) {
	var items []models.SmsMessage

	session := r.engine.Where("device_id = ?", deviceID)

	if smsType > 0 {
		session = session.And("type = ?", smsType)
	}

	if keyword != "" {
		session = session.And("(address LIKE ? OR name LIKE ? OR body LIKE ?)",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	// Get total count
	total, err := session.Count(&models.SmsMessage{})
	if err != nil {
		return nil, 0, err
	}

	// Reset session for actual query
	session = r.engine.Where("device_id = ?", deviceID)
	if smsType > 0 {
		session = session.And("type = ?", smsType)
	}
	if keyword != "" {
		session = session.And("(address LIKE ? OR name LIKE ? OR body LIKE ?)",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
	}

	// Apply pagination and ordering
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	err = session.Desc("sms_time").Limit(pageSize, offset).Find(&items)
	if err != nil {
		return nil, 0, err
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
