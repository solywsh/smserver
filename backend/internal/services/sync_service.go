package services

import (
	"log"

	"backend/internal/models"
	"backend/internal/phoneclient"
	"backend/internal/repository"

	"xorm.io/xorm"
)

// SyncService handles incremental data synchronization from phone.
type SyncService struct {
	engine *xorm.Engine
}

// NewSyncService creates a new SyncService.
func NewSyncService(engine *xorm.Engine) *SyncService {
	return &SyncService{engine: engine}
}

// SyncResult represents the result of a sync operation.
type SyncResult struct {
	NewCount     int  `json:"new_count"`
	UpdatedCount int  `json:"updated_count"`
	IsComplete   bool `json:"is_complete"` // true if reached existing data or no more data
}

// SyncSms performs incremental SMS sync from phone.
// Fetches pages of SMS until it encounters existing records.
// If smsType is 0, syncs both received (1) and sent (2) messages.
func (s *SyncService) SyncSms(device *models.Device, smsType int) (*SyncResult, error) {
	result := &SyncResult{}

	// If type is 0 (all), sync both received and sent
	if smsType == 0 {
		// Sync received messages
		r1, err := s.syncSmsType(device, 1)
		if err != nil {
			return result, err
		}
		result.NewCount += r1.NewCount

		// Sync sent messages
		r2, err := s.syncSmsType(device, 2)
		if err != nil {
			return result, err
		}
		result.NewCount += r2.NewCount
		result.IsComplete = r1.IsComplete && r2.IsComplete
		return result, nil
	}

	return s.syncSmsType(device, smsType)
}

// syncSmsType syncs SMS of a specific type.
// Logic: Fetch pages until all items in a page already exist in DB, or no more data.
// This ensures we capture all new records even if they're not strictly ordered.
func (s *SyncService) syncSmsType(device *models.Device, smsType int) (*SyncResult, error) {
	client := phoneclient.NewClient(device)
	repo := repository.NewSmsRepository(s.engine)

	const pageSize = 50
	const maxPages = 100
	pageNum := 1
	result := &SyncResult{}

	// Reduced logging: only log start and errors
	for pageNum <= maxPages {
		// Fetch from phone
		items, err := client.QuerySms(phoneclient.SmsQueryRequest{
			Type:     smsType,
			PageNum:  pageNum,
			PageSize: pageSize,
		})
		if err != nil {
			log.Printf("[SyncSms] device %d type %d page %d error: %v", device.ID, smsType, pageNum, err)
			return result, err
		}

		// No more data
		if len(items) == 0 {
			result.IsComplete = true
			break
		}

		var newItems []*models.SmsMessage
		existingCount := 0

		for _, item := range items {
			// Check if exists
			exists, err := repo.Exists(device.ID, item.Number, item.Date, item.Type)
			if err != nil {
				log.Printf("[SyncSms] check exists error: %v", err)
				continue
			}

			if exists {
				existingCount++
			} else {
				newItems = append(newItems, &models.SmsMessage{
					DeviceID: device.ID,
					Address:  item.Number,
					Name:     item.Name,
					Body:     item.Content,
					Type:     item.Type,
					SimID:    item.SimID,
					SmsTime:  item.Date,
				})
			}
		}

		// Save new items
		if len(newItems) > 0 {
			inserted, err := repo.InsertBatch(newItems)
			if err != nil {
				log.Printf("[SyncSms] insert batch error: %v", err)
			} else {
				result.NewCount += int(inserted)
			}
		}

		// Stop only when ALL items in this page already exist (no new data to sync)
		if len(newItems) == 0 {
			result.IsComplete = true
			break
		}

		// There were new items, continue to next page to check for more
		pageNum++
	}

	// Only log if there were new messages
	if result.NewCount > 0 {
		log.Printf("[SyncSms] device %d type %d: synced %d new messages", device.ID, smsType, result.NewCount)
	}
	return result, nil
}

// SyncCalls performs incremental call log sync from phone.
// callType: 0=all, 1=incoming, 2=outgoing, 3=missed
// Phone API supports type=0 to fetch all types at once.
// Logic: Fetch pages until all items in a page already exist in DB, or no more data.
func (s *SyncService) SyncCalls(device *models.Device, callType int) (*SyncResult, error) {
	client := phoneclient.NewClient(device)
	repo := repository.NewCallRepository(s.engine)

	const pageSize = 50
	const maxPages = 100
	pageNum := 1
	result := &SyncResult{}

	// Reduced logging: only log errors and final result
	for pageNum <= maxPages {
		// Fetch from phone
		items, err := client.QueryCalls(phoneclient.CallQueryRequest{
			Type:     callType,
			PageNum:  pageNum,
			PageSize: pageSize,
		})
		if err != nil {
			log.Printf("[SyncCalls] device %d type %d page %d error: %v", device.ID, callType, pageNum, err)
			return result, err
		}

		// No more data
		if len(items) == 0 {
			result.IsComplete = true
			break
		}

		var newItems []*models.CallLog
		existingCount := 0

		for _, item := range items {
			// Check if exists
			exists, err := repo.Exists(device.ID, item.Number, item.DateLong, item.Type)
			if err != nil {
				log.Printf("[SyncCalls] check exists error: %v", err)
				continue
			}

			if exists {
				existingCount++
			} else {
				newItems = append(newItems, &models.CallLog{
					DeviceID: device.ID,
					Number:   item.Number,
					Name:     item.Name,
					Type:     item.Type,
					Duration: item.Duration,
					SimID:    item.SimID,
					CallTime: item.DateLong,
				})
			}
		}

		// Save new items
		if len(newItems) > 0 {
			inserted, err := repo.InsertBatch(newItems)
			if err != nil {
				log.Printf("[SyncCalls] insert batch error: %v", err)
			} else {
				result.NewCount += int(inserted)
			}
		}

		// Stop only when ALL items in this page already exist (no new data to sync)
		if len(newItems) == 0 {
			result.IsComplete = true
			break
		}

		// There were new items, continue to next page to check for more
		pageNum++
	}

	// Only log if there were new calls
	if result.NewCount > 0 {
		log.Printf("[SyncCalls] device %d type %d: synced %d new calls", device.ID, callType, result.NewCount)
	}
	return result, nil
}

// SyncContacts performs full contact sync from phone.
// Since phone API doesn't support pagination, we do full sync.
func (s *SyncService) SyncContacts(device *models.Device) (*SyncResult, error) {
	client := phoneclient.NewClient(device)
	repo := repository.NewContactRepository(s.engine)

	result := &SyncResult{}

	// Fetch all contacts from phone
	items, err := client.QueryContacts(phoneclient.ContactQueryRequest{})
	if err != nil {
		log.Printf("[SyncContacts] device %d error: %v", device.ID, err)
		return result, err
	}

	for _, item := range items {
		contact := &models.Contact{
			DeviceID: device.ID,
			Name:     item.Name,
			Phone:    item.PhoneNumber,
		}

		isNew, err := repo.Upsert(contact)
		if err != nil {
			log.Printf("[SyncContacts] upsert error: %v", err)
			continue
		}

		if isNew {
			result.NewCount++
		} else {
			result.UpdatedCount++
		}
	}

	result.IsComplete = true
	// Only log if there were changes
	if result.NewCount > 0 || result.UpdatedCount > 0 {
		log.Printf("[SyncContacts] device %d: synced %d new, %d updated", device.ID, result.NewCount, result.UpdatedCount)
	}
	return result, nil
}
