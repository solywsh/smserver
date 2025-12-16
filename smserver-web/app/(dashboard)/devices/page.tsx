'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, Device } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  Smartphone,
  Battery,
  BatteryCharging,
  MapPin,
  Clock,
  Trash2,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Globe,
  Pencil,
} from 'lucide-react';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', phoneAddr: '', sm4Key: '', remark: '' });
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState(false);

  // Edit device state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phoneAddr: '', sm4Key: '', remark: '' });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingDeviceId, setRefreshingDeviceId] = useState<number | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    const res = await api.getDevices();
    if (res.data) {
      setDevices(res.data.items || []);
    } else {
      toast.error(res.error || 'Failed to fetch devices');
    }
    setLoading(false);
  }, []);

  const refreshDevices = async () => {
    setRefreshing(true);
    const res = await api.refreshDevices();
    if (res.data) {
      setDevices(res.data.items || []);
      toast.success(`Refreshed ${res.data.refreshed} devices (${res.data.online_count} online)`);
    } else {
      toast.error(res.error || 'Failed to refresh devices');
    }
    setRefreshing(false);
  };

  const refreshSingleDevice = async (deviceId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRefreshingDeviceId(deviceId);

    const configRes = await api.getPhoneConfig(deviceId);
    if (configRes.data) {
      await fetchDevices();
      toast.success('Device refreshed successfully');
    } else {
      toast.error(configRes.error || 'Failed to refresh device');
    }

    setRefreshingDeviceId(null);
  };

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleCreateDevice = async () => {
    if (!newDevice.name.trim()) {
      toast.error('Device name is required');
      return;
    }
    if (!newDevice.phoneAddr.trim()) {
      toast.error('Phone address is required');
      return;
    }
    if (!newDevice.sm4Key.trim()) {
      toast.error('SM4 Key is required');
      return;
    }
    if (newDevice.sm4Key.length !== 32) {
      toast.error('SM4 Key must be 32 hex characters');
      return;
    }

    setCreating(true);
    const res = await api.createDevice(
      newDevice.name.trim(),
      newDevice.phoneAddr.trim(),
      newDevice.sm4Key.trim(),
      newDevice.remark.trim() || undefined
    );
    if (res.data) {
      toast.success('Device added successfully');
      handleCloseDialog();

      // Refresh device config and status immediately
      const configRes = await api.getPhoneConfig(res.data.id);
      if (configRes.error) {
        toast.warning('Device added but failed to fetch config: ' + configRes.error);
      }

      // Refresh all devices to get latest status
      await refreshDevices();
    } else {
      toast.error(res.error || 'Failed to create device');
    }
    setCreating(false);
  };

  const handleTestConnection = async () => {
    if (!newDevice.phoneAddr.trim() || !newDevice.sm4Key.trim()) {
      toast.error('Please fill in phone address and SM4 Key first');
      return;
    }

    // Create a temporary device to test
    setTesting(true);
    const createRes = await api.createDevice(
      'temp_test_' + Date.now(),
      newDevice.phoneAddr.trim(),
      newDevice.sm4Key.trim()
    );

    if (createRes.data) {
      // Try to get config
      const configRes = await api.getPhoneConfig(createRes.data.id);
      // Delete temporary device
      await api.deleteDevice(createRes.data.id);

      if (configRes.data) {
        toast.success('Connection successful! Phone is reachable.');
        // Auto-fill device name if available
        if (configRes.data.extra_device_mark && !newDevice.name) {
          setNewDevice(prev => ({ ...prev, name: configRes.data!.extra_device_mark || '' }));
        }
      } else {
        toast.error('Connection failed: ' + (configRes.error || 'Unknown error'));
      }
    } else {
      toast.error('Failed to test: ' + (createRes.error || 'Unknown error'));
    }
    setTesting(false);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setNewDevice({ name: '', phoneAddr: '', sm4Key: '', remark: '' });
  };

  const handleDeleteDevice = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    const res = await api.deleteDevice(id);
    if (!res.error) {
      toast.success('Device deleted');
      fetchDevices();
    } else {
      toast.error(res.error || 'Failed to delete device');
    }
  };

  const handleEditDevice = (device: Device, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingDevice(device);
    setEditForm({
      name: device.name,
      phoneAddr: device.phone_addr,
      sm4Key: device.sm4_key,
      remark: device.remark || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveDevice = async () => {
    if (!editingDevice) return;
    if (!editForm.name.trim()) {
      toast.error('Device name is required');
      return;
    }
    if (!editForm.phoneAddr.trim()) {
      toast.error('Phone address is required');
      return;
    }
    if (!editForm.sm4Key.trim()) {
      toast.error('SM4 Key is required');
      return;
    }
    if (editForm.sm4Key.length !== 32) {
      toast.error('SM4 Key must be 32 hex characters');
      return;
    }

    setSaving(true);
    const res = await api.updateDevice(editingDevice.id, {
      name: editForm.name.trim(),
      phone_addr: editForm.phoneAddr.trim(),
      sm4_key: editForm.sm4Key.trim(),
      remark: editForm.remark.trim(),
    });
    if (res.data) {
      toast.success('Device updated successfully');
      setEditDialogOpen(false);
      setEditingDevice(null);
      fetchDevices();
    } else {
      toast.error(res.error || 'Failed to update device');
    }
    setSaving(false);
  };

  const getStatusBadge = (device: Device) => {
    if (device.status === 'online') {
      return <Badge variant="default" className="bg-green-500">Online</Badge>;
    } else if (device.status === 'offline') {
      return <Badge variant="outline">Offline</Badge>;
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    return date.toLocaleString();
  };

  const getBatteryDisplay = (device: Device) => {
    if (!device.battery_level) return null;
    // "充电中" means charging, "未充电" means not charging, "充满电" means full
    const isCharging = device.battery_status === '充电中' || device.battery_plugged === 'AC' || device.battery_plugged === 'USB';
    const isFull = device.battery_status === '充满电';
    const Icon = isCharging || isFull ? BatteryCharging : Battery;
    return (
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isCharging || isFull ? 'text-green-500' : ''}`} />
        <span>{device.battery_level}</span>
        {isFull && <span className="text-xs text-green-500">Full</span>}
        {isCharging && !isFull && <span className="text-xs text-green-500">Charging</span>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Devices</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-6 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Devices</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refreshDevices} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) {
              handleCloseDialog();
            } else {
              setDialogOpen(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Device</DialogTitle>
                <DialogDescription>
                  Enter the phone&apos;s SmsForwarder server address and SM4 key.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneAddr">Phone Address *</Label>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      id="phoneAddr"
                      placeholder="http://192.168.1.100:5000"
                      value={newDevice.phoneAddr}
                      onChange={(e) => setNewDevice({ ...newDevice, phoneAddr: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    SmsForwarder HTTP server address (e.g., http://192.168.1.100:5000 or http://your-domain.com)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sm4Key">SM4 Key *</Label>
                  <Input
                    id="sm4Key"
                    placeholder="32-character hex string"
                    value={newDevice.sm4Key}
                    onChange={(e) => setNewDevice({ ...newDevice, sm4Key: e.target.value })}
                    className="font-mono"
                    maxLength={32}
                  />
                  <p className="text-xs text-muted-foreground">
                    32-character hex key from SmsForwarder app settings ({newDevice.sm4Key.length}/32)
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testing || !newDevice.phoneAddr || !newDevice.sm4Key}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Wifi className="mr-2 h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Device Name *</Label>
                    <Input
                      id="name"
                      placeholder="My Phone"
                      value={newDevice.name}
                      onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="remark">Remark (optional)</Label>
                    <Textarea
                      id="remark"
                      placeholder="Optional notes about this device"
                      value={newDevice.remark}
                      onChange={(e) => setNewDevice({ ...newDevice, remark: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">SmsForwarder Setup:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open SmsForwarder app on your phone</li>
                    <li>Go to &quot;主动控制·服务端&quot; (Active Control Server)</li>
                    <li>Enable the server and note the port (default: 5000)</li>
                    <li>Set encryption to &quot;SM4&quot; and copy the key</li>
                    <li>Enter the phone&apos;s IP:port and SM4 key above</li>
                  </ol>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCreateDevice} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Device'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No devices yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first device to start managing it remotely.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <Card key={device.id} className="group relative">
              <Link href={`/devices/${device.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Smartphone className="h-5 w-5" />
                      {device.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {getStatusBadge(device)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => refreshSingleDevice(device.id, e)}
                        disabled={refreshingDeviceId === device.id}
                        title="Refresh device status"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshingDeviceId === device.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleEditDevice(device, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteDevice(device.id, device.name);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {device.device_mark && (
                    <CardDescription>{device.device_mark}</CardDescription>
                  )}
                  {device.remark && !device.device_mark && (
                    <CardDescription>{device.remark}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {device.status === 'online' ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : (
                        <WifiOff className="h-4 w-4" />
                      )}
                      <span className="truncate">{device.phone_addr}</span>
                    </div>
                    {getBatteryDisplay(device)}
                    {(device.latitude !== 0 || device.longitude !== 0) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{formatLastSeen(device.last_seen)}</span>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Device Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          setEditingDevice(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update device information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Device Name *</Label>
              <Input
                id="edit-name"
                placeholder="My Phone"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phoneAddr">Phone Address *</Label>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  id="edit-phoneAddr"
                  placeholder="http://192.168.1.100:5000"
                  value={editForm.phoneAddr}
                  onChange={(e) => setEditForm({ ...editForm, phoneAddr: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-sm4Key">SM4 Key *</Label>
              <Input
                id="edit-sm4Key"
                placeholder="32-character hex string"
                value={editForm.sm4Key}
                onChange={(e) => setEditForm({ ...editForm, sm4Key: e.target.value })}
                className="font-mono"
                maxLength={32}
              />
              <p className="text-xs text-muted-foreground">
                {editForm.sm4Key.length}/32 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-remark">Remark (optional)</Label>
              <Textarea
                id="edit-remark"
                placeholder="Optional notes about this device"
                value={editForm.remark}
                onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDevice} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
