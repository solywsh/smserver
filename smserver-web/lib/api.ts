const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 204 No Content or empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      if (!response.ok) {
        return { error: 'Request failed' };
      }
      return { data: {} as T };
    }

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Request failed' };
    }

    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

export interface User {
  id: number;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Device represents a phone running SmsForwarder app
export interface Device {
  id: number;
  name: string;
  phone_addr: string;   // Phone HTTP server address
  sm4_key: string;      // SM4 encryption key
  status: string;       // online, offline, unknown
  battery: number;
  battery_level: string;   // e.g., "85%"
  battery_status: string;  // e.g., "充电中", "未充电"
  battery_plugged: string; // e.g., "AC", "USB", "无"
  latitude: number;
  longitude: number;
  sim_info: string;
  device_mark: string;
  extra_sim1: string;
  extra_sim2: string;
  polling_interval: number; // Polling interval in seconds (0=disabled, 5/10/15/30/60)
  last_seen: string;
  remark: string;
  created_at: string;
}

// Phone config response from /config/query
export interface PhoneConfig {
  enable_api_battery_query: boolean;
  enable_api_call_query: boolean;
  enable_api_clone: boolean;
  enable_api_contact_query: boolean;
  enable_api_sms_query: boolean;
  enable_api_sms_send: boolean;
  enable_api_wol: boolean;
  extra_device_mark?: string;
  extra_sim1?: string;
  extra_sim2?: string;
  sim_info_list?: Record<string, unknown>;
}

// SMS message from database (cached from phone)
export interface SmsMessage {
  id: number;
  device_id: number;
  address: string;    // phone number
  name: string;       // contact name
  body: string;       // content
  type: number;       // 1=received, 2=sent
  sim_id: number;     // 0=SIM1, 1=SIM2, -1=unknown
  sms_time: number;   // timestamp in milliseconds
  created_at: string;
}

// Call log from database (cached from phone)
export interface CallLog {
  id: number;
  device_id: number;
  number: string;
  name: string;
  type: number;       // 1=incoming, 2=outgoing, 3=missed
  duration: number;   // seconds
  sim_id: number;     // 0=SIM1, 1=SIM2, -1=unknown
  call_time: number;  // timestamp in milliseconds
  created_at: string;
}

// Contact from database (cached from phone)
export interface Contact {
  id: number;
  device_id: number;
  name: string;
  phone: string;
  email?: string;
  note?: string;
  created_at: string;
}

// SMS message with device info (for all-devices query)
export interface SmsMessageWithDevice extends SmsMessage {
  device_name: string;
}

// Call log with device info (for all-devices query)
export interface CallLogWithDevice extends CallLog {
  device_name: string;
}

// Sync result from backend
export interface SyncResult {
  new_count: number;
  updated_count: number;
  is_complete: boolean;
}

// Paginated response with optional sync result
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  sync?: SyncResult;
}

// Contacts response (no pagination)
export interface ContactsResponse {
  items: Contact[];
  total: number;
  sync?: SyncResult;
}

// Battery status from phone
export interface BatteryStatus {
  level: string;
  scale: string;
  voltage?: string;
  temperature?: string;
  status: string;
  health: string;
  plugged: string;
}

// Location from phone
export interface LocationInfo {
  address?: string;
  latitude: number;
  longitude: number;
  provider?: string;
  time: string;
}

// Clone configuration (一键换新机)
// Uses Record<string, unknown> for flexibility as the config has many optional fields
export type CloneConfig = Record<string, unknown>;

// Sender item in clone config
export interface CloneSender {
  id: number;
  type: number;
  name: string;
  status: number;
  time: string;
  json_setting: string;
}

// Rule item in clone config
export interface CloneRule {
  id: number;
  type: string;
  filed: string;
  check: string;
  value: string;
  sender_id: number;
  sms_template: string;
  regex_replace: string;
  sim_slot: string;
  status: number;
  time: string;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<LoginResponse>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getProfile: () => request<User>('/api/profile'),

  updatePassword: (oldPassword: string, newPassword: string) =>
    request('/api/users/password', {
      method: 'POST',
      body: JSON.stringify({ old: oldPassword, new: newPassword }),
    }),

  // Devices
  getDevices: () => request<{ items: Device[] }>('/api/devices'),

  refreshDevices: () => request<{ items: Device[]; refreshed: number; online_count: number }>('/api/devices/refresh', {
    method: 'POST',
  }),

  createDevice: (name: string, phoneAddr: string, sm4Key: string, remark?: string, pollingInterval?: number) =>
    request<Device>('/api/devices', {
      method: 'POST',
      body: JSON.stringify({ name, phone_addr: phoneAddr, sm4_key: sm4Key, remark, polling_interval: pollingInterval }),
    }),

  getDevice: (id: string | number) => request<Device>(`/api/devices/${id}`),

  updateDevice: (id: string | number, data: { name?: string; phone_addr?: string; sm4_key?: string; remark?: string; polling_interval?: number }) =>
    request<Device>(`/api/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDevice: (id: string | number) =>
    request(`/api/devices/${id}`, { method: 'DELETE' }),

  // Test connection and get phone config
  getPhoneConfig: (deviceId: string | number) =>
    request<PhoneConfig>(`/api/devices/${deviceId}/config`),

  // All devices SMS - query from database
  getAllSms: (type?: number, pageNum?: number, pageSize?: number, keyword?: string, deviceId?: number) => {
    const params = new URLSearchParams();
    if (type !== undefined) params.append('type', type.toString());
    if (pageNum !== undefined) params.append('page_num', pageNum.toString());
    if (pageSize !== undefined) params.append('page_size', pageSize.toString());
    if (keyword) params.append('keyword', keyword);
    if (deviceId) params.append('device_id', deviceId.toString());
    const queryString = params.toString();
    return request<PaginatedResponse<SmsMessageWithDevice>>(`/api/sms${queryString ? `?${queryString}` : ''}`);
  },

  // All devices calls - query from database
  getAllCalls: (type?: number, pageNum?: number, pageSize?: number, phoneNumber?: string, deviceId?: number) => {
    const params = new URLSearchParams();
    if (type !== undefined) params.append('type', type.toString());
    if (pageNum !== undefined) params.append('page_num', pageNum.toString());
    if (pageSize !== undefined) params.append('page_size', pageSize.toString());
    if (phoneNumber) params.append('phone_number', phoneNumber);
    if (deviceId) params.append('device_id', deviceId.toString());
    const queryString = params.toString();
    return request<PaginatedResponse<CallLogWithDevice>>(`/api/calls${queryString ? `?${queryString}` : ''}`);
  },

  // SMS - query from database with background sync
  getDeviceSms: (deviceId: string | number, type?: number, pageNum?: number, pageSize?: number, keyword?: string, forceSync?: boolean) => {
    const params = new URLSearchParams();
    if (type !== undefined) params.append('type', type.toString());
    if (pageNum !== undefined) params.append('page_num', pageNum.toString());
    if (pageSize !== undefined) params.append('page_size', pageSize.toString());
    if (keyword) params.append('keyword', keyword);
    if (forceSync) params.append('sync', 'true');
    const queryString = params.toString();
    return request<PaginatedResponse<SmsMessage>>(`/api/devices/${deviceId}/sms${queryString ? `?${queryString}` : ''}`);
  },

  // SMS - manual sync from phone
  syncDeviceSms: (deviceId: string | number, type?: number) =>
    request<SyncResult>(`/api/devices/${deviceId}/sms/sync`, {
      method: 'POST',
      body: JSON.stringify({ type: type || 0 }),
    }),

  sendSms: (deviceId: string | number, simSlot: number, phoneNumbers: string, msgContent: string) =>
    request<{ message: string }>(`/api/devices/${deviceId}/sms/send`, {
      method: 'POST',
      body: JSON.stringify({ sim_slot: simSlot, phone_numbers: phoneNumbers, msg_content: msgContent }),
    }),

  // Calls - query from database with background sync
  getDeviceCalls: (deviceId: string | number, type?: number, pageNum?: number, pageSize?: number, phoneNumber?: string, forceSync?: boolean) => {
    const params = new URLSearchParams();
    if (type !== undefined) params.append('type', type.toString());
    if (pageNum !== undefined) params.append('page_num', pageNum.toString());
    if (pageSize !== undefined) params.append('page_size', pageSize.toString());
    if (phoneNumber) params.append('phone_number', phoneNumber);
    if (forceSync) params.append('sync', 'true');
    const queryString = params.toString();
    return request<PaginatedResponse<CallLog>>(`/api/devices/${deviceId}/calls${queryString ? `?${queryString}` : ''}`);
  },

  // Calls - manual sync from phone
  syncDeviceCalls: (deviceId: string | number, type?: number) =>
    request<SyncResult>(`/api/devices/${deviceId}/calls/sync`, {
      method: 'POST',
      body: JSON.stringify({ type: type || 0 }),
    }),

  // Contacts - query from database with background sync
  getDeviceContacts: (deviceId: string | number, keyword?: string, forceSync?: boolean) => {
    const params = new URLSearchParams();
    if (keyword) params.append('keyword', keyword);
    if (forceSync) params.append('sync', 'true');
    const queryString = params.toString();
    return request<ContactsResponse>(`/api/devices/${deviceId}/contacts${queryString ? `?${queryString}` : ''}`);
  },

  // Contacts - manual sync from phone
  syncDeviceContacts: (deviceId: string | number) =>
    request<SyncResult>(`/api/devices/${deviceId}/contacts/sync`, {
      method: 'POST',
    }),

  addContact: (deviceId: string | number, name: string, phoneNumber: string) =>
    request<{ message: string }>(`/api/devices/${deviceId}/contacts/add`, {
      method: 'POST',
      body: JSON.stringify({ name, phone_number: phoneNumber }),
    }),

  // Battery - query from phone
  getBattery: (deviceId: string | number) =>
    request<BatteryStatus>(`/api/devices/${deviceId}/battery`),

  // Location - query from phone
  getLocation: (deviceId: string | number) =>
    request<LocationInfo>(`/api/devices/${deviceId}/location`),

  // Wake-on-LAN
  wakeOnLan: (deviceId: string | number, mac: string, ip?: string, port?: number) =>
    request<{ message: string }>(`/api/devices/${deviceId}/wol`, {
      method: 'POST',
      body: JSON.stringify({ mac, ip, port }),
    }),

  // Clone configuration (一键换新机)
  clonePull: (deviceId: string | number, versionCode: number) =>
    request<CloneConfig>(`/api/devices/${deviceId}/clone/pull`, {
      method: 'POST',
      body: JSON.stringify({ version_code: versionCode }),
    }),

  clonePush: (deviceId: string | number, config: CloneConfig) =>
    request<{ message: string }>(`/api/devices/${deviceId}/clone/push`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),
};
