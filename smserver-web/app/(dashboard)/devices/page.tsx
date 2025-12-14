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
  MapPin,
  Clock,
  Trash2,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Globe,
} from 'lucide-react';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', phoneAddr: '', sm4Key: '', remark: '' });
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState(false);

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
      fetchDevices();
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
          <Button variant="outline" size="icon" onClick={fetchDevices}>
            <RefreshCw className="h-4 w-4" />
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getStatusBadge(device)}
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
                    {device.battery > 0 && (
                      <div className="flex items-center gap-2">
                        <Battery className="h-4 w-4" />
                        <span>{device.battery}%</span>
                      </div>
                    )}
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
    </div>
  );
}
