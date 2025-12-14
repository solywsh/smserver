package repository

import (
	"backend/internal/models"

	"xorm.io/xorm"
)

// ContactRepository handles contact data access.
type ContactRepository struct {
	engine *xorm.Engine
}

// NewContactRepository creates a new ContactRepository.
func NewContactRepository(engine *xorm.Engine) *ContactRepository {
	return &ContactRepository{engine: engine}
}

// Exists checks if a contact exists by unique key.
func (r *ContactRepository) Exists(deviceID int64, phone string) (bool, error) {
	return r.engine.Where("device_id = ? AND phone = ?", deviceID, phone).Exist(&models.Contact{})
}

// FindByDeviceAndPhone finds a contact by device and phone.
func (r *ContactRepository) FindByDeviceAndPhone(deviceID int64, phone string) (*models.Contact, error) {
	contact := &models.Contact{}
	has, err := r.engine.Where("device_id = ? AND phone = ?", deviceID, phone).Get(contact)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, nil
	}
	return contact, nil
}

// Insert inserts a single contact record.
func (r *ContactRepository) Insert(contact *models.Contact) error {
	_, err := r.engine.Insert(contact)
	return err
}

// Update updates a contact's name.
func (r *ContactRepository) Update(contact *models.Contact) error {
	_, err := r.engine.ID(contact.ID).Cols("name").Update(contact)
	return err
}

// Upsert inserts or updates a contact.
// If the contact exists, update the name. Otherwise, insert a new record.
func (r *ContactRepository) Upsert(contact *models.Contact) (isNew bool, err error) {
	existing, err := r.FindByDeviceAndPhone(contact.DeviceID, contact.Phone)
	if err != nil {
		return false, err
	}

	if existing != nil {
		// Update if name changed
		if existing.Name != contact.Name {
			existing.Name = contact.Name
			err = r.Update(existing)
			return false, err
		}
		return false, nil
	}

	// Insert new contact
	err = r.Insert(contact)
	return true, err
}

// FindByDevice returns contacts for a device.
func (r *ContactRepository) FindByDevice(deviceID int64, keyword string) ([]models.Contact, int64, error) {
	var items []models.Contact

	session := r.engine.Where("device_id = ?", deviceID)

	if keyword != "" {
		session = session.And("(name LIKE ? OR phone LIKE ?)",
			"%"+keyword+"%", "%"+keyword+"%")
	}

	// Get total count
	total, err := session.Count(&models.Contact{})
	if err != nil {
		return nil, 0, err
	}

	// Reset session for actual query
	session = r.engine.Where("device_id = ?", deviceID)
	if keyword != "" {
		session = session.And("(name LIKE ? OR phone LIKE ?)",
			"%"+keyword+"%", "%"+keyword+"%")
	}

	err = session.Asc("name").Find(&items)
	if err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

// CountByDevice returns the number of contacts for a device.
func (r *ContactRepository) CountByDevice(deviceID int64) (int64, error) {
	return r.engine.Where("device_id = ?", deviceID).Count(&models.Contact{})
}
