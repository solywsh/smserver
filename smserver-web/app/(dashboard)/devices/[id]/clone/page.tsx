'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, Device, CloneConfig, PhoneConfig } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Download,
  Upload,
  RefreshCw,
  Loader2,
  Copy,
  FileJson,
  AlertTriangle,
  Check,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Common SmsForwarder version codes
// Format: arch_prefix + version, e.g., 3.3.2 arm64 = 300332
// Arch prefixes: 10=universal, 20=armeabi-v7a, 30=arm64-v8a, 40=x86, 50=x86_64

export default function CloneConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [phoneConfig, setPhoneConfig] = useState<PhoneConfig | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [configJson, setConfigJson] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [sourceDevice, setSourceDevice] = useState<string>('');
  const [isValidJson, setIsValidJson] = useState(true);
  const [showPushConfirm, setShowPushConfirm] = useState(false);

  // Fetch current device info
  const fetchDevice = useCallback(async () => {
    const res = await api.getDevice(resolvedParams.id);
    if (res.data) {
      setDevice(res.data);
    } else {
      toast.error(res.error || 'Failed to fetch device');
    }
  }, [resolvedParams.id]);

  // Fetch phone config to check if clone is enabled
  const fetchPhoneConfig = useCallback(async () => {
    const res = await api.getPhoneConfig(resolvedParams.id);
    if (res.data) {
      setPhoneConfig(res.data);
    }
  }, [resolvedParams.id]);

  // Fetch all devices for source selection
  const fetchDevices = useCallback(async () => {
    const res = await api.getDevices();
    if (res.data?.items) {
      setDevices(res.data.items);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    Promise.all([fetchDevice(), fetchPhoneConfig(), fetchDevices()]).finally(() => {
      setLoading(false);
    });
  }, [fetchDevice, fetchPhoneConfig, fetchDevices]);

  // Validate JSON when config changes
  useEffect(() => {
    if (!configJson.trim()) {
      setIsValidJson(true);
      return;
    }
    try {
      JSON.parse(configJson);
      setIsValidJson(true);
    } catch {
      setIsValidJson(false);
    }
  }, [configJson]);

  // Pull config from a device
  const handlePullConfig = async (deviceId: string) => {
    const code = parseInt(versionCode);
    if (!code) {
      toast.error('Please enter a valid version code');
      return;
    }
    setPulling(true);
    const res = await api.clonePull(deviceId, code);
    if (res.data) {
      setConfigJson(JSON.stringify(res.data, null, 2));
      toast.success('Configuration pulled successfully');
    } else {
      toast.error(res.error || 'Failed to pull configuration');
    }
    setPulling(false);
  };

  // Pull from current device
  const handlePullFromCurrent = () => {
    handlePullConfig(resolvedParams.id);
  };

  // Pull from selected source device
  const handlePullFromSource = () => {
    if (!sourceDevice) {
      toast.error('Please select a source device');
      return;
    }
    handlePullConfig(sourceDevice);
  };

  // Push config to current device
  const handlePushConfig = async () => {
    if (!configJson.trim()) {
      toast.error('Configuration is empty');
      return;
    }

    let config: CloneConfig;
    try {
      config = JSON.parse(configJson);
    } catch {
      toast.error('Invalid JSON format');
      return;
    }

    setPushing(true);
    const res = await api.clonePush(resolvedParams.id, config);
    if (res.data) {
      toast.success('Configuration pushed successfully');
      setShowPushConfirm(false);
    } else {
      toast.error(res.error || 'Failed to push configuration');
    }
    setPushing(false);
  };

  // Format JSON
  const handleFormatJson = () => {
    if (!configJson.trim()) return;
    try {
      const parsed = JSON.parse(configJson);
      setConfigJson(JSON.stringify(parsed, null, 2));
      toast.success('JSON formatted');
    } catch {
      toast.error('Invalid JSON - cannot format');
    }
  };

  // Minify JSON
  const handleMinifyJson = () => {
    if (!configJson.trim()) return;
    try {
      const parsed = JSON.parse(configJson);
      setConfigJson(JSON.stringify(parsed));
      toast.success('JSON minified');
    } catch {
      toast.error('Invalid JSON - cannot minify');
    }
  };

  // Copy to clipboard
  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configJson);
      toast.success('Configuration copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  // Get other devices (excluding current)
  const otherDevices = devices.filter(d => d.id.toString() !== resolvedParams.id);

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

  const cloneEnabled = phoneConfig?.enable_api_clone ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/devices/${resolvedParams.id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Clone Configuration</h1>
            {cloneEnabled ? (
              <Badge variant="default" className="bg-green-500">Enabled</Badge>
            ) : (
              <Badge variant="outline">Disabled</Badge>
            )}
          </div>
          <p className="text-muted-foreground">{device.name} - {device.device_mark || device.phone_addr}</p>
        </div>
      </div>

      {!cloneEnabled && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              <span>Clone API is not enabled on this device. Please enable it in SmsForwarder settings first.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pull Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Pull Configuration
            </CardTitle>
            <CardDescription>
              Pull configuration from a device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Version Code</Label>
              <Input
                type="number"
                placeholder="e.g., 300332"
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value)}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Check in SmsForwarder: Settings &gt; About</p>
                <p className="font-medium">Version format: [Arch][Version]</p>
                <ul className="list-disc list-inside pl-1 space-y-0.5">
                  <li><code>10XXXX</code> universal (all architectures)</li>
                  <li><code>20XXXX</code> armeabi-v7a (32-bit ARM)</li>
                  <li><code>30XXXX</code> arm64-v8a (64-bit ARM, mainstream)</li>
                  <li><code>40XXXX</code> x86 | <code>50XXXX</code> x86_64</li>
                </ul>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handlePullFromCurrent}
              disabled={pulling || !cloneEnabled || !versionCode}
            >
              {pulling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Pull from Current Device
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or from another device
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Source Device</Label>
              <Select value={sourceDevice} onValueChange={setSourceDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {otherDevices.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{d.name}</span>
                        {d.status === 'online' && (
                          <Badge variant="outline" className="text-xs">online</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {otherDevices.length === 0 && (
                    <SelectItem value="_none" disabled>
                      No other devices available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handlePullFromSource}
              disabled={pulling || !sourceDevice || !versionCode}
            >
              {pulling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Pull from Selected Device
            </Button>
          </CardContent>
        </Card>

        {/* Configuration Editor */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Configuration Editor
                </CardTitle>
                <CardDescription>
                  Edit and manage device configuration
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {configJson && (
                  isValidJson ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Check className="mr-1 h-3 w-3" />
                      Valid JSON
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Invalid JSON
                    </Badge>
                  )
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleFormatJson} disabled={!configJson}>
                Format
              </Button>
              <Button variant="outline" size="sm" onClick={handleMinifyJson} disabled={!configJson}>
                Minify
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyConfig} disabled={!configJson}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <div className="flex-1" />
              <Button
                onClick={() => setShowPushConfirm(true)}
                disabled={pushing || !configJson || !isValidJson || !cloneEnabled}
              >
                {pushing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Push to Device
              </Button>
            </div>

            <Textarea
              className="min-h-[500px] font-mono text-sm"
              placeholder="Configuration JSON will appear here after pulling from a device..."
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Push Confirmation Dialog */}
      <AlertDialog open={showPushConfirm} onOpenChange={setShowPushConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Configuration Push</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to push this configuration to <strong>{device.name}</strong>?
              This will overwrite the existing configuration on the device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePushConfig} disabled={pushing}>
              {pushing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Push Configuration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
