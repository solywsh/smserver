'use client';

import { SmsMessage } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatMessageTime, getSimLabel } from '@/lib/conversation-utils';
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MessageBubbleProps {
  message: SmsMessage;
  deviceName?: string; // For global SMS page
  showDeviceName?: boolean; // Whether to show device name
  onDelete?: (id: number) => void;
  onSelect?: (id: number) => void;
  isSelected?: boolean;
  selectionMode?: boolean;
}

export function MessageBubble({
  message,
  deviceName,
  showDeviceName = false,
  onDelete,
  onSelect,
  isSelected = false,
  selectionMode = false,
}: MessageBubbleProps) {
  const isSent = message.type === 2;
  const isReceived = message.type === 1;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.body);
    toast.success('已复制到剪贴板');
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(message.id);
    }
  };

  const handleClick = () => {
    if (selectionMode && onSelect) {
      onSelect(message.id);
    }
  };

  return (
    <div
      className={cn(
        'flex mb-3 group',
        isSent ? 'justify-end' : 'justify-start',
        selectionMode && 'cursor-pointer',
        isSelected && 'opacity-70'
      )}
      onClick={handleClick}
    >
      <div
        className={cn(
          'flex flex-col max-w-[70%]',
          isSent ? 'items-end' : 'items-start'
        )}
      >
        {/* Contact name (for received messages) */}
        {isReceived && message.name && (
          <div className="text-xs font-medium mb-1 px-1">
            {message.name}
          </div>
        )}

        {/* SIM card badge (for sent messages) */}
        {isSent && message.sim_id >= 0 && (
          <div className="mb-1">
            <Badge
              variant="outline"
              className={cn(
                'h-5 text-xs',
                message.sim_id === 0
                  ? 'border-blue-500 text-blue-700 dark:text-blue-400'
                  : 'border-green-500 text-green-700 dark:text-green-400'
              )}
            >
              {getSimLabel(message.sim_id)}
            </Badge>
          </div>
        )}

        {/* Device name (for global SMS page) */}
        {showDeviceName && deviceName && (
          <div className="mb-1">
            <Badge variant="secondary" className="h-5 text-xs">
              {deviceName}
            </Badge>
          </div>
        )}

        {/* Message bubble */}
        <div className="flex items-start gap-2">
          <div
            className={cn(
              'rounded-lg px-4 py-2 break-words',
              isSent
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted',
              selectionMode && isSelected && 'ring-2 ring-primary'
            )}
          >
            <p className="whitespace-pre-wrap break-words text-sm">
              {message.body}
            </p>
          </div>

          {/* Action menu (only when not in selection mode) */}
          {!selectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isSent ? 'end' : 'start'}>
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy className="mr-2 h-4 w-4" />
                  复制
                </DropdownMenuItem>
                {onDelete && (
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground mt-1 px-1">
          {formatMessageTime(message.sms_time)}
        </span>
      </div>
    </div>
  );
}
