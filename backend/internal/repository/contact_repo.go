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

// Upsert inserts or updates a contact from device sync.
// If the contact exists (even if hidden), update the name and mark as not hidden.
// Otherwise, insert a new record (not hidden).
func (r *ContactRepository) Upsert(contact *models.Contact) (isNew bool, err error) {
	existing, err := r.FindByDeviceAndPhone(contact.DeviceID, contact.Phone)
	if err != nil {
		return false, err
	}

	if existing != nil {
		// Update if name changed or was hidden
		needsUpdate := false
		if existing.Name != contact.Name {
			existing.Name = contact.Name
			needsUpdate = true
		}
		if existing.IsHidden {
			existing.IsHidden = false
			needsUpdate = true
		}
		if needsUpdate {
			_, err = r.engine.ID(existing.ID).Cols("name", "is_hidden").Update(existing)
			return false, err
		}
		return false, nil
	}

	// Insert new contact (not hidden, from device sync)
	contact.IsHidden = false
	err = r.Insert(contact)
	return true, err
}

// EnsureHiddenContact ensures a hidden contact exists for a phone number.
// If contact doesn't exist, creates a hidden contact with name = phone number.
// If contact exists and is hidden, does nothing.
// If contact exists and is not hidden (real contact), does nothing.
// Special handling: if name is "未知号码" or "Unknown Number", use phone number as name.
// Returns the contact (existing or newly created).
func (r *ContactRepository) EnsureHiddenContact(deviceID int64, phone, name string) (*models.Contact, error) {
	// Try to find existing contact
	existing, err := r.FindByDeviceAndPhone(deviceID, phone)
	if err != nil {
		return nil, err
	}

	// If contact exists, return it (whether hidden or not)
	if existing != nil {
		return existing, nil
	}

	// Create hidden contact
	// If name is empty, "未知号码", "Unknown Number", or same as phone, use phone number as name
	contactName := name
	if contactName == "" ||
		contactName == phone ||
		contactName == "未知号码" ||
		contactName == "Unknown Number" {
		contactName = phone
	}

	contact := &models.Contact{
		DeviceID: deviceID,
		Name:     contactName,
		Phone:    phone,
		IsHidden: true,
	}

	err = r.Insert(contact)
	if err != nil {
		return nil, err
	}

	return contact, nil
}

// FindByDevice returns contacts for a device.
// By default, only returns non-hidden contacts (real contacts from device).
func (r *ContactRepository) FindByDevice(deviceID int64, keyword string) ([]models.Contact, int64, error) {
	var items []models.Contact

	session := r.engine.Where("device_id = ? AND is_hidden = ?", deviceID, false)

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
	session = r.engine.Where("device_id = ? AND is_hidden = ?", deviceID, false)
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

// HasAnySynced checks if any contacts (including hidden) have been synced for a device.
// Returns true if there are any contacts (hidden or not) for the device.
func (r *ContactRepository) HasAnySynced(deviceID int64) (bool, error) {
	count, err := r.engine.Where("device_id = ?", deviceID).Count(&models.Contact{})
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
