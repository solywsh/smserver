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

// SMS message from phone
export interface SmsMessage {
  content: string;
  number: string;
  name: string;
  type: number;     // 1=received, 2=sent
  date: number;     // timestamp in milliseconds
  sim_id: number;   // 0=SIM1, 1=SIM2, -1=unknown
  sub_id: number;
}

// Call log from phone
export interface CallLog {
  dateLong: number; // timestamp in milliseconds
  number: string;
  name?: string;
  sim_id: number;   // 0=SIM1, 1=SIM2, -1=unknown
  type: number;     // 1=incoming, 2=outgoing, 3=missed
  duration: number; // seconds
}

// Contact from phone
export interface Contact {
  name: string;
  phone_number: string;
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

  createDevice: (name: string, phoneAddr: string, sm4Key: string, remark?: string) =>
    request<Device>('/api/devices', {
      method: 'POST',
      body: JSON.stringify({ name, phone_addr: phoneAddr, sm4_key: sm4Key, remark }),
    }),

  getDevice: (id: string | number) => request<Device>(`/api/devices/${id}`),

  updateDevice: (id: string | number, data: { name?: string; phone_addr?: string; sm4_key?: string; remark?: string }) =>
    request<Device>(`/api/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDevice: (id: string | number) =>
    request(`/api/devices/${id}`, { method: 'DELETE' }),

  // Test connection and get phone config
  getPhoneConfig: (deviceId: string | number) =>
    request<PhoneConfig>(`/api/devices/${deviceId}/config`),

  // SMS - query from phone
  getDeviceSms: (deviceId: string | number, type?: number, pageNum?: number, pageSize?: number, keyword?: string) => {
    const params = new URLSearchParams();
    if (type !== undefined) params.append('type', type.toString());
    if (pageNum !== undefined) params.append('page_num', pageNum.toString());
    if (pageSize !== undefined) params.append('page_size', pageSize.toString());
    if (keyword) params.append('keyword', keyword);
    const queryString = params.toString();
    return request<{ items: SmsMessage[] }>(`/api/devices/${deviceId}/sms${queryString ? `?${queryString}` : ''}`);
  },

  sendSms: (deviceId: string | number, simSlot: number, phoneNumbers: string, msgContent: string) =>
    request<{ message: string }>(`/api/devices/${deviceId}/sms/send`, {
      method: 'POST',
      body: JSON.stringify({ sim_slot: simSlot, phone_numbers: phoneNumbers, msg_content: msgContent }),
    }),

  // Calls - query from phone
  getDeviceCalls: (deviceId: string | number, type?: number, pageNum?: number, pageSize?: number, phoneNumber?: string) => {
    const params = new URLSearchParams();
    if (type !== undefined) params.append('type', type.toString());
    if (pageNum !== undefined) params.append('page_num', pageNum.toString());
    if (pageSize !== undefined) params.append('page_size', pageSize.toString());
    if (phoneNumber) params.append('phone_number', phoneNumber);
    const queryString = params.toString();
    return request<{ items: CallLog[] }>(`/api/devices/${deviceId}/calls${queryString ? `?${queryString}` : ''}`);
  },

  // Contacts - query from phone
  getDeviceContacts: (deviceId: string | number, phoneNumber?: string, name?: string) => {
    const params = new URLSearchParams();
    if (phoneNumber) params.append('phone_number', phoneNumber);
    if (name) params.append('name', name);
    const queryString = params.toString();
    return request<{ items: Contact[] }>(`/api/devices/${deviceId}/contacts${queryString ? `?${queryString}` : ''}`);
  },

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
