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
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface MessageComposerProps {
  address: string; // Target phone number
  deviceId?: number; // For device-specific page (optional)
  devices?: Device[]; // For global page (optional)
  onSent?: () => void; // Callback after message sent
  className?: string;
}

export function MessageComposer({
  address,
  deviceId,
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
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Settings row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Device selection (only for global page) */}
        {devices && devices.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="device-select" className="text-sm whitespace-nowrap">
              设备:
            </Label>
            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger id="device-select" className="w-[180px]">
                <SelectValue placeholder="选择设备" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id.toString()}>
                    {device.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* SIM card selection */}
        <div className="flex items-center gap-2">
          <Label htmlFor="sim-select" className="text-sm whitespace-nowrap">
            SIM卡:
          </Label>
          <Select value={simSlot} onValueChange={(v) => setSimSlot(v as '1' | '2')}>
            <SelectTrigger id="sim-select" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">SIM 1</SelectItem>
              <SelectItem value="2">SIM 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Message input and send button */}
      <div className="flex gap-2">
        <Textarea
          placeholder="输入消息内容... (Enter发送, Shift+Enter换行)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          className="flex-1 resize-none"
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

      {/* Helper text */}
      <div className="text-xs text-muted-foreground">
        提示: Enter发送消息, Shift+Enter换行
      </div>
    </div>
  );
}
