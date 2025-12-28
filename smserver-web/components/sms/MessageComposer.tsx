'use client';

import { useState, KeyboardEvent, useEffect } from 'react';
import { Device } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface MessageComposerProps {
  address: string; // Target phone number
  deviceId?: number; // For device-specific page (optional)
  device?: Device | null; // For device-specific page (optional)
  devices?: Device[]; // For global page (optional)
  onSent?: () => void; // Callback after message sent
  className?: string;
}

export function MessageComposer({
  address,
  deviceId,
  device,
  devices,
  onSent,
  className,
}: MessageComposerProps) {
  const [simSlot, setSimSlot] = useState<'1' | '2'>('1');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  // For global page: initialize selectedDeviceId if devices are provided
  useEffect(() => {
    if (devices && devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id.toString());
    }
  }, [devices, selectedDeviceId]);

  // Get current device (either from device-specific page or global page)
  const currentDevice = device || devices?.find((d) => d.id === parseInt(selectedDeviceId));

  // Load last used SIM slot from localStorage
  useEffect(() => {
    const lastSimSlot = localStorage.getItem('lastUsedSimSlot');
    if (lastSimSlot === '1' || lastSimSlot === '2') {
      setSimSlot(lastSimSlot);
    }
  }, []);

  const handleSend = async () => {
    if (!content.trim()) {
      toast.error('请输入消息内容');
      return;
    }

    const targetDeviceId = deviceId || parseInt(selectedDeviceId);

    if (!targetDeviceId) {
      toast.error('请选择设备');
      return;
    }

    setSending(true);

    try {
      const res = await api.sendSms(
        targetDeviceId,
        parseInt(simSlot),
        address,
        content.trim()
      );

      if (res.data) {
        toast.success('消息已发送');
        setContent('');
        // Save last used SIM slot
        localStorage.setItem('lastUsedSimSlot', simSlot);
        onSent?.();
      } else {
        toast.error(res.error || '发送失败');
      }
    } catch (error) {
      toast.error('发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('flex flex-col gap-2 p-3', className)}>
      {/* Settings row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Device selection (only for global page) */}
        {devices && devices.length > 0 && (
          <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Select device" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.id} value={device.id.toString()} className="text-xs">
                  {device.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* SIM card selection */}
        <Select value={simSlot} onValueChange={(v) => setSimSlot(v as '1' | '2')}>
          <SelectTrigger className="h-8 w-[90px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1" className="text-xs">SIM 1</SelectItem>
            <SelectItem value="2" className="text-xs">SIM 2</SelectItem>
          </SelectContent>
        </Select>

        {/* SIM card info display */}
        {currentDevice && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {simSlot === '1' && currentDevice.extra_sim1 && (
              <span className="px-2 py-1 bg-secondary rounded">
                {currentDevice.extra_sim1}
              </span>
            )}
            {simSlot === '2' && currentDevice.extra_sim2 && (
              <span className="px-2 py-1 bg-secondary rounded">
                {currentDevice.extra_sim2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Message input and send button */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="flex-1 resize-none text-sm"
          disabled={sending}
        />
        <Button
          onClick={handleSend}
          disabled={sending || !content.trim()}
          className="self-end"
          size="icon"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
