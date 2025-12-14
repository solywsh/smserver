package phoneclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"backend/internal/models"
	"backend/internal/security"
)

// Client is a client for calling SmsForwarder API on phone
type Client struct {
	device     *models.Device
	httpClient *http.Client
}

// NewClient creates a new phone client for the given device
func NewClient(device *models.Device) *Client {
	return &Client{
		device: device,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Request represents the standard SmsForwarder request format
type Request struct {
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
	Sign      string      `json:"sign"`
}

// Response represents the standard SmsForwarder response format
type Response struct {
	Code      int         `json:"code"`
	Msg       string      `json:"msg"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
	Sign      string      `json:"sign,omitempty"`
}

// doRequest sends an SM4-encrypted request to the phone and decrypts the response
func (c *Client) doRequest(uri string, data interface{}) (*Response, error) {
	// Build request
	req := Request{
		Data:      data,
		Timestamp: time.Now().UnixMilli(),
		Sign:      "",
	}

	// Marshal and encrypt
	reqBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	encryptedReq, err := security.SM4EncryptHex(c.device.SM4Key, reqBytes)
	if err != nil {
		return nil, fmt.Errorf("encrypt request: %w", err)
	}

	// Send request
	url := c.device.PhoneAddr + uri
	httpReq, err := http.NewRequest("POST", url, bytes.NewBufferString(encryptedReq))
	if err != nil {
		return nil, fmt.Errorf("create http request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json; charset=utf-8")

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer httpResp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	// Decrypt response
	decryptedResp, err := security.SM4DecryptHex(c.device.SM4Key, string(respBody))
	if err != nil {
		return nil, fmt.Errorf("decrypt response: %w", err)
	}

	// Parse response
	var resp Response
	if err := json.Unmarshal(decryptedResp, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if resp.Code != 200 {
		return &resp, fmt.Errorf("phone returned error: %s", resp.Msg)
	}

	return &resp, nil
}

// ConfigQueryResponse represents the response from /config/query
type ConfigQueryResponse struct {
	EnableAPIBatteryQuery bool                   `json:"enable_api_battery_query"`
	EnableAPICallQuery    bool                   `json:"enable_api_call_query"`
	EnableAPIClone        bool                   `json:"enable_api_clone"`
	EnableAPIContactQuery bool                   `json:"enable_api_contact_query"`
	EnableAPISmsQuery     bool                   `json:"enable_api_sms_query"`
	EnableAPISmsSend      bool                   `json:"enable_api_sms_send"`
	EnableAPIWol          bool                   `json:"enable_api_wol"`
	ExtraDeviceMark       string                 `json:"extra_device_mark,omitempty"`
	ExtraSim1             string                 `json:"extra_sim1,omitempty"`
	ExtraSim2             string                 `json:"extra_sim2,omitempty"`
	SimInfoList           map[string]interface{} `json:"sim_info_list,omitempty"`
}

// QueryConfig calls /config/query to get phone configuration
func (c *Client) QueryConfig() (*ConfigQueryResponse, error) {
	resp, err := c.doRequest("/config/query", map[string]interface{}{})
	if err != nil {
		return nil, err
	}

	// Parse response data
	dataBytes, err := json.Marshal(resp.Data)
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	var config ConfigQueryResponse
	if err := json.Unmarshal(dataBytes, &config); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	return &config, nil
}

// SmsSendRequest represents parameters for sending SMS
type SmsSendRequest struct {
	SimSlot      int    `json:"sim_slot"`      // 1=SIM1, 2=SIM2
	PhoneNumbers string `json:"phone_numbers"` // Semicolon-separated phone numbers
	MsgContent   string `json:"msg_content"`   // SMS content
}

// SendSms calls /sms/send to send SMS via phone
func (c *Client) SendSms(req SmsSendRequest) error {
	_, err := c.doRequest("/sms/send", req)
	return err
}

// SmsQueryRequest represents parameters for querying SMS
type SmsQueryRequest struct {
	Type     int    `json:"type"`      // 1=received, 2=sent
	PageNum  int    `json:"page_num"`  // Page number, default 1
	PageSize int    `json:"page_size"` // Page size, default 10
	Keyword  string `json:"keyword"`   // Keyword filter
}

// SmsItem represents a single SMS message
type SmsItem struct {
	Content string `json:"content"`
	Number  string `json:"number"`
	Name    string `json:"name"`
	Type    int    `json:"type"`   // 1=received, 2=sent
	Date    int64  `json:"date"`   // Timestamp in milliseconds
	SimID   int    `json:"sim_id"` // 0=SIM1, 1=SIM2, -1=unknown
	SubID   int    `json:"sub_id"`
}

// QuerySms calls /sms/query to query SMS messages
func (c *Client) QuerySms(req SmsQueryRequest) ([]SmsItem, error) {
	if req.PageNum <= 0 {
		req.PageNum = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	resp, err := c.doRequest("/sms/query", req)
	if err != nil {
		return nil, err
	}

	dataBytes, err := json.Marshal(resp.Data)
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	var items []SmsItem
	if err := json.Unmarshal(dataBytes, &items); err != nil {
		return nil, fmt.Errorf("unmarshal sms items: %w", err)
	}

	return items, nil
}

// CallQueryRequest represents parameters for querying call logs
type CallQueryRequest struct {
	Type        int    `json:"type"`         // 0=all, 1=incoming, 2=outgoing, 3=missed
	PageNum     int    `json:"page_num"`     // Page number
	PageSize    int    `json:"page_size"`    // Page size
	PhoneNumber string `json:"phone_number"` // Filter by phone number
}

// CallItem represents a single call log entry
type CallItem struct {
	DateLong int64  `json:"dateLong"` // Timestamp in milliseconds
	Number   string `json:"number"`
	Name     string `json:"name,omitempty"`
	SimID    int    `json:"sim_id"`   // 0=SIM1, 1=SIM2, -1=unknown
	Type     int    `json:"type"`     // 1=incoming, 2=outgoing, 3=missed
	Duration int    `json:"duration"` // Seconds
}

// QueryCalls calls /call/query to query call logs
func (c *Client) QueryCalls(req CallQueryRequest) ([]CallItem, error) {
	if req.PageNum <= 0 {
		req.PageNum = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 10
	}

	resp, err := c.doRequest("/call/query", req)
	if err != nil {
		return nil, err
	}

	dataBytes, err := json.Marshal(resp.Data)
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	var items []CallItem
	if err := json.Unmarshal(dataBytes, &items); err != nil {
		return nil, fmt.Errorf("unmarshal call items: %w", err)
	}

	return items, nil
}

// ContactQueryRequest represents parameters for querying contacts
type ContactQueryRequest struct {
	PhoneNumber string `json:"phone_number"` // Filter by phone number
	Name        string `json:"name"`         // Filter by name
}

// ContactItem represents a single contact
type ContactItem struct {
	Name        string `json:"name"`
	PhoneNumber string `json:"phone_number"`
}

// QueryContacts calls /contact/query to query contacts
func (c *Client) QueryContacts(req ContactQueryRequest) ([]ContactItem, error) {
	resp, err := c.doRequest("/contact/query", req)
	if err != nil {
		return nil, err
	}

	dataBytes, err := json.Marshal(resp.Data)
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	var items []ContactItem
	if err := json.Unmarshal(dataBytes, &items); err != nil {
		return nil, fmt.Errorf("unmarshal contact items: %w", err)
	}

	return items, nil
}

// ContactAddRequest represents parameters for adding a contact
type ContactAddRequest struct {
	PhoneNumber string `json:"phone_number"` // Semicolon-separated phone numbers
	Name        string `json:"name"`
}

// AddContact calls /contact/add to add a contact to the phone
func (c *Client) AddContact(req ContactAddRequest) error {
	_, err := c.doRequest("/contact/add", req)
	return err
}

// BatteryResponse represents battery status
type BatteryResponse struct {
	Level       string `json:"level"`       // e.g., "100%"
	Scale       string `json:"scale"`       // e.g., "100%"
	Voltage     string `json:"voltage"`     // e.g., "4200mV"
	Temperature string `json:"temperature"` // e.g., "25°C"
	Status      string `json:"status"`      // e.g., "charging"
	Health      string `json:"health"`      // e.g., "good"
	Plugged     string `json:"plugged"`     // e.g., "AC"
}

// QueryBattery calls /battery/query to get battery status
func (c *Client) QueryBattery() (*BatteryResponse, error) {
	resp, err := c.doRequest("/battery/query", map[string]interface{}{})
	if err != nil {
		return nil, err
	}

	dataBytes, err := json.Marshal(resp.Data)
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	var battery BatteryResponse
	if err := json.Unmarshal(dataBytes, &battery); err != nil {
		return nil, fmt.Errorf("unmarshal battery: %w", err)
	}

	return &battery, nil
}

// WolRequest represents parameters for Wake-on-LAN
type WolRequest struct {
	Mac  string `json:"mac"`
	IP   string `json:"ip,omitempty"`
	Port int    `json:"port,omitempty"`
}

// SendWol calls /wol/send to send Wake-on-LAN packet
func (c *Client) SendWol(req WolRequest) error {
	_, err := c.doRequest("/wol/send", req)
	return err
}

// LocationResponse represents location data
type LocationResponse struct {
	Address   string  `json:"address"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Provider  string  `json:"provider"`
	Time      string  `json:"time"`
}

// QueryLocation calls /location/query to get phone location
func (c *Client) QueryLocation() (*LocationResponse, error) {
	resp, err := c.doRequest("/location/query", map[string]interface{}{})
	if err != nil {
		return nil, err
	}

	dataBytes, err := json.Marshal(resp.Data)
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	var location LocationResponse
	if err := json.Unmarshal(dataBytes, &location); err != nil {
		return nil, fmt.Errorf("unmarshal location: %w", err)
	}

	return &location, nil
}
