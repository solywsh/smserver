'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, Device, PhoneConfig, BatteryStatus, LocationInfo } from '@/lib/api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Smartphone,
  Battery,
  MapPin,
  Clock,
  Send,
  Power,
  MessageSquare,
  PhoneCall,
  Users,
  Copy,
  RefreshCw,
  Globe,
  Wifi,
  WifiOff,
  Loader2,
  Thermometer,
  Plug,
  BatteryWarning,
  MapPinOff,
} from 'lucide-react';

export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [phoneConfig, setPhoneConfig] = useState<PhoneConfig | null>(null);
  const [batteryStatus, setBatteryStatus] = useState<BatteryStatus | null>(null);
  const [batteryError, setBatteryError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialStatusFetched, setInitialStatusFetched] = useState(false);
  const [sendSmsOpen, setSendSmsOpen] = useState(false);
  const [wolOpen, setWolOpen] = useState(false);
  const [smsForm, setSmsForm] = useState({ simSlot: '1', phoneNumbers: '', content: '' });
  const [wolForm, setWolForm] = useState({ mac: '', ip: '', port: '' });
  const [sendingSms, setSendingSms] = useState(false);
  const [sendingWol, setSendingWol] = useState(false);

  const fetchDevice = useCallback(async () => {
    const res = await api.getDevice(resolvedParams.id);
    if (res.data) {
      setDevice(res.data);
    } else {
      toast.error(res.error || 'Failed to fetch device');
    }
    setLoading(false);
  }, [resolvedParams.id]);

  const fetchPhoneStatus = useCallback(async (showToast = true) => {
    setRefreshing(true);
    setBatteryError(null);
    setLocationError(null);

    try {
      // First fetch config to check what features are enabled
      const configRes = await api.getPhoneConfig(resolvedParams.id);

      if (configRes.data) {
        setPhoneConfig(configRes.data);
        // Refresh device info to get updated status
        fetchDevice();

        // Only fetch battery if enabled
        if (configRes.data.enable_api_battery_query) {
          const batteryRes = await api.getBattery(resolvedParams.id);
          if (batteryRes.data) {
            setBatteryStatus(batteryRes.data);
          } else {
            setBatteryError(batteryRes.error || 'Failed to fetch battery');
          }
        } else {
          setBatteryError('Battery query not enabled on phone');
        }

        // Fetch location (may not be enabled, API v3.2.0+)
        const locationRes = await api.getLocation(resolvedParams.id);
        if (locationRes.data) {
          setLocation(locationRes.data);
        } else {
          setLocationError(locationRes.error || 'Location query not available');
        }

        if (showToast) {
          toast.success('Phone status refreshed');
        }
      } else {
        if (showToast) {
          toast.error('Failed to connect to phone: ' + (configRes.error || 'Unknown error'));
        }
      }
    } catch {
      if (showToast) {
        toast.error('Failed to refresh phone status');
      }
    }
    setRefreshing(false);
  }, [resolvedParams.id, fetchDevice]);

  // Initial device fetch
  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  // Auto-fetch phone status after device is loaded
  useEffect(() => {
    if (device && !initialStatusFetched) {
      setInitialStatusFetched(true);
      fetchPhoneStatus(false);
    }
  }, [device, initialStatusFetched, fetchPhoneStatus]);

  const handleSendSms = async () => {
    if (!smsForm.phoneNumbers.trim() || !smsForm.content.trim()) {
      toast.error('Phone numbers and content are required');
      return;
    }
    setSendingSms(true);
    const res = await api.sendSms(
      resolvedParams.id,
      parseInt(smsForm.simSlot),
      smsForm.phoneNumbers.trim(),
      smsForm.content.trim()
    );
    if (res.data) {
      toast.success('SMS sent successfully');
      setSendSmsOpen(false);
      setSmsForm({ simSlot: '1', phoneNumbers: '', content: '' });
    } else {
      toast.error(res.error || 'Failed to send SMS');
    }
    setSendingSms(false);
  };

  const handleWol = async () => {
    if (!wolForm.mac.trim()) {
      toast.error('MAC address is required');
      return;
    }
    setSendingWol(true);
    const res = await api.wakeOnLan(
      resolvedParams.id,
      wolForm.mac.trim(),
      wolForm.ip.trim() || undefined,
      wolForm.port ? parseInt(wolForm.port) : undefined
    );
    if (res.data) {
      toast.success('WOL packet sent successfully');
      setWolOpen(false);
      setWolForm({ mac: '', ip: '', port: '' });
    } else {
      toast.error(res.error || 'Failed to send WOL');
    }
    setSendingWol(false);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success(`${label} copied to clipboard`);
      } catch {
        toast.error('Failed to copy. Please copy manually.');
      }
      document.body.removeChild(textArea);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'online') {
      return <Badge variant="default" className="bg-green-500">Online</Badge>;
    } else if (status === 'offline') {
      return <Badge variant="outline">Offline</Badge>;
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium">Device not found</h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/devices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{device.name}</h1>
            {getStatusBadge(device.status)}
          </div>
          {device.device_mark && (
            <p className="text-muted-foreground">{device.device_mark}</p>
          )}
          {device.remark && !device.device_mark && (
            <p className="text-muted-foreground">{device.remark}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => fetchPhoneStatus(true)} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh Status
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Device Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Phone Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Globe className="h-4 w-4" />
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                    {device.phone_addr}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(device.phone_addr, 'Phone Address')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">SM4 Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                    {device.sm4_key}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(device.sm4_key, 'SM4 Key')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Connection Status</Label>
                <div className="flex items-center gap-2 mt-1">
                  {device.status === 'online' ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  <span>{device.status}</span>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Last Seen</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4" />
                  <span>{new Date(device.last_seen).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* SIM Info */}
            {(device.extra_sim1 || device.extra_sim2) && (
              <div>
                <Label className="text-muted-foreground">SIM Cards</Label>
                <div className="mt-1 space-y-1">
                  {device.extra_sim1 && (
                    <div className="text-sm bg-muted px-3 py-2 rounded">
                      <span className="font-medium">SIM 1:</span> {device.extra_sim1}
                    </div>
                  )}
                  {device.extra_sim2 && (
                    <div className="text-sm bg-muted px-3 py-2 rounded">
                      <span className="font-medium">SIM 2:</span> {device.extra_sim2}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Battery Status */}
            <div>
              <Label className="text-muted-foreground">Battery Status</Label>
              {batteryStatus ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                  <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded">
                    <Battery className="h-4 w-4" />
                    <span>{batteryStatus.level}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded">
                    <Plug className="h-4 w-4" />
                    <span>{batteryStatus.status}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded">
                    <span className="text-sm">{batteryStatus.plugged}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded">
                    <span className="text-sm">{batteryStatus.health}</span>
                  </div>
                </div>
              ) : batteryError ? (
                <div className="flex items-center gap-2 mt-1 text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                  <BatteryWarning className="h-4 w-4" />
                  <span className="text-sm">Unavailable - {batteryError}</span>
                </div>
              ) : refreshing ? (
                <div className="flex items-center gap-2 mt-1 text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1 text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                  <BatteryWarning className="h-4 w-4" />
                  <span className="text-sm">Click &quot;Refresh Status&quot; to fetch battery info</span>
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <Label className="text-muted-foreground">Location</Label>
              {location && (location.latitude !== 0 || location.longitude !== 0) ? (
                <div className="mt-1 bg-muted px-3 py-2 rounded">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
                  </div>
                  {location.address && (
                    <p className="text-sm text-muted-foreground mt-1">{location.address}</p>
                  )}
                  {location.time && (
                    <p className="text-xs text-muted-foreground mt-1">Last updated: {location.time}</p>
                  )}
                </div>
              ) : locationError ? (
                <div className="flex items-center gap-2 mt-1 text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                  <MapPinOff className="h-4 w-4" />
                  <span className="text-sm">Unavailable - {locationError}</span>
                </div>
              ) : refreshing ? (
                <div className="flex items-center gap-2 mt-1 text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1 text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                  <MapPinOff className="h-4 w-4" />
                  <span className="text-sm">Click &quot;Refresh Status&quot; to fetch location info</span>
                </div>
              )}
            </div>

            {/* Phone Config */}
            {phoneConfig && (
              <div>
                <Label className="text-muted-foreground">Enabled Features</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {phoneConfig.enable_api_sms_send && <Badge variant="outline">SMS Send</Badge>}
                  {phoneConfig.enable_api_sms_query && <Badge variant="outline">SMS Query</Badge>}
                  {phoneConfig.enable_api_call_query && <Badge variant="outline">Call Query</Badge>}
                  {phoneConfig.enable_api_contact_query && <Badge variant="outline">Contact Query</Badge>}
                  {phoneConfig.enable_api_battery_query && <Badge variant="outline">Battery Query</Badge>}
                  {phoneConfig.enable_api_wol && <Badge variant="outline">Wake-on-LAN</Badge>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Control the phone remotely</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Dialog open={sendSmsOpen} onOpenChange={setSendSmsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Send className="mr-2 h-4 w-4" />
                  Send SMS
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send SMS</DialogTitle>
                  <DialogDescription>
                    Send an SMS message through this phone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>SIM Card</Label>
                    <Select value={smsForm.simSlot} onValueChange={(v) => setSmsForm({ ...smsForm, simSlot: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">SIM 1</SelectItem>
                        <SelectItem value="2">SIM 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumbers">Phone Numbers</Label>
                    <Input
                      id="phoneNumbers"
                      placeholder="15888888888;19999999999"
                      value={smsForm.phoneNumbers}
                      onChange={(e) => setSmsForm({ ...smsForm, phoneNumbers: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Multiple numbers separated by semicolons</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Message</Label>
                    <Textarea
                      id="content"
                      placeholder="Enter message content"
                      value={smsForm.content}
                      onChange={(e) => setSmsForm({ ...smsForm, content: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSendSmsOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSendSms} disabled={sendingSms}>
                    {sendingSms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={wolOpen} onOpenChange={setWolOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Power className="mr-2 h-4 w-4" />
                  Wake on LAN
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Wake on LAN</DialogTitle>
                  <DialogDescription>
                    Send a WOL magic packet to wake a computer.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="mac">MAC Address *</Label>
                    <Input
                      id="mac"
                      placeholder="24:5E:BE:0C:45:9A"
                      value={wolForm.mac}
                      onChange={(e) => setWolForm({ ...wolForm, mac: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ip">IP Address (optional)</Label>
                    <Input
                      id="ip"
                      placeholder="192.168.1.100"
                      value={wolForm.ip}
                      onChange={(e) => setWolForm({ ...wolForm, ip: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port (optional)</Label>
                    <Input
                      id="port"
                      placeholder="9"
                      type="number"
                      value={wolForm.port}
                      onChange={(e) => setWolForm({ ...wolForm, port: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWolOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleWol} disabled={sendingWol}>
                    {sendingWol ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="border-t pt-4 mt-2">
              <p className="text-sm text-muted-foreground mb-3">View Data</p>
              <div className="grid gap-2">
                <Link href={`/devices/${device.id}/sms`}>
                  <Button variant="outline" className="w-full justify-start bg-background hover:bg-muted">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    View SMS
                  </Button>
                </Link>
                <Link href={`/devices/${device.id}/calls`}>
                  <Button variant="outline" className="w-full justify-start bg-background hover:bg-muted">
                    <PhoneCall className="mr-2 h-4 w-4" />
                    View Calls
                  </Button>
                </Link>
                <Link href={`/devices/${device.id}/contacts`}>
                  <Button variant="outline" className="w-full justify-start bg-background hover:bg-muted">
                    <Users className="mr-2 h-4 w-4" />
                    View Contacts
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
