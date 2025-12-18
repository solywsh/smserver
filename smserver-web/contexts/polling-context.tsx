'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, Device } from '@/lib/api';
import { toast } from 'sonner';

interface PollingContextType {
  smsCount: number;
  callsCount: number;
  clearSmsCount: () => void;
  clearCallsCount: () => void;
  notifications: Notification[];
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  onSmsUpdate: (callback: (deviceId: number) => void) => () => void;
  onCallsUpdate: (callback: (deviceId: number) => void) => () => void;
}

interface Notification {
  id: string;
  type: 'sms' | 'call';
  deviceId: number;
  deviceName: string;
  count: number;
  timestamp: number;
}

const PollingContext = createContext<PollingContextType | undefined>(undefined);

export function PollingProvider({ children }: { children: ReactNode }) {
  const [smsCount, setSmsCount] = useState(0);
  const [callsCount, setCallsCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pollingTimers, setPollingTimers] = useState<Map<number, NodeJS.Timeout>>(new Map());
  const [smsCallbacks, setSmsCallbacks] = useState<Set<(deviceId: number) => void>>(new Set());
  const [callsCallbacks, setCallsCallbacks] = useState<Set<(deviceId: number) => void>>(new Set());

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    const res = await api.getDevices();
    if (res.data) {
      setDevices(res.data.items || []);
    }
  }, []);

  // Poll device for SMS and calls
  const pollDevice = useCallback(async (device: Device) => {
    try {
      // Sync SMS
      const smsRes = await api.syncDeviceSms(device.id, 0); // 0 = all types
      if (smsRes.data && smsRes.data.new_count > 0) {
        setSmsCount(prev => prev + smsRes.data!.new_count);

        // Add notification
        const notification: Notification = {
          id: `sms-${device.id}-${Date.now()}`,
          type: 'sms',
          deviceId: device.id,
          deviceName: device.name,
          count: smsRes.data.new_count,
          timestamp: Date.now(),
        };
        setNotifications(prev => [...prev, notification]);

        // Trigger SMS update callbacks
        smsCallbacks.forEach(callback => callback(device.id));
      }

      // Sync Calls
      const callsRes = await api.syncDeviceCalls(device.id, 0); // 0 = all types
      if (callsRes.data && callsRes.data.new_count > 0) {
        setCallsCount(prev => prev + callsRes.data!.new_count);

        // Add notification
        const notification: Notification = {
          id: `call-${device.id}-${Date.now()}`,
          type: 'call',
          deviceId: device.id,
          deviceName: device.name,
          count: callsRes.data.new_count,
          timestamp: Date.now(),
        };
        setNotifications(prev => [...prev, notification]);

        // Trigger Calls update callbacks
        callsCallbacks.forEach(callback => callback(device.id));
      }
    } catch (error) {
      console.error(`Failed to poll device ${device.name}:`, error);
    }
  }, [smsCallbacks, callsCallbacks]);

  // Setup polling timers for devices
  useEffect(() => {
    // Clear existing timers
    pollingTimers.forEach(timer => clearInterval(timer));
    const newTimers = new Map<number, NodeJS.Timeout>();

    // Setup new timers for devices with polling enabled
    devices.forEach(device => {
      if (device.polling_interval > 0 && device.status === 'online') {
        const interval = device.polling_interval * 1000; // Convert to milliseconds
        const timer = setInterval(() => {
          pollDevice(device);
        }, interval);
        newTimers.set(device.id, timer);
      }
    });

    setPollingTimers(newTimers);

    // Cleanup on unmount
    return () => {
      newTimers.forEach(timer => clearInterval(timer));
    };
  }, [devices, pollDevice]);

  // Fetch devices on mount and periodically
  useEffect(() => {
    fetchDevices();
    // Refresh device list every 60 seconds to pick up status changes
    const interval = setInterval(fetchDevices, 60000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const clearSmsCount = () => setSmsCount(0);
  const clearCallsCount = () => setCallsCount(0);

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const onSmsUpdate = useCallback((callback: (deviceId: number) => void) => {
    setSmsCallbacks(prev => new Set([...prev, callback]));
    return () => {
      setSmsCallbacks(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  const onCallsUpdate = useCallback((callback: (deviceId: number) => void) => {
    setCallsCallbacks(prev => new Set([...prev, callback]));
    return () => {
      setCallsCallbacks(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  return (
    <PollingContext.Provider
      value={{
        smsCount,
        callsCount,
        clearSmsCount,
        clearCallsCount,
        notifications,
        clearNotification,
        clearAllNotifications,
        onSmsUpdate,
        onCallsUpdate,
      }}
    >
      {children}
    </PollingContext.Provider>
  );
}

export function usePolling() {
  const context = useContext(PollingContext);
  if (context === undefined) {
    throw new Error('usePolling must be used within a PollingProvider');
  }
  return context;
}
