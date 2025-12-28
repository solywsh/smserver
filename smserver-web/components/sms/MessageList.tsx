'use client';

import { useEffect, useRef } from 'react';
import { SmsMessage, SmsMessageWithDevice } from '@/lib/api';
import { MessageBubble } from './MessageBubble';
import { ScrollArea } from '@/components/ui/scroll-area';
import { groupMessagesByDate, formatDateHeader } from '@/lib/conversation-utils';

interface MessageListProps {
  messages: SmsMessage[] | SmsMessageWithDevice[];
  showDeviceName?: boolean; // For global SMS page
  deviceMap?: Map<number, string>; // Map device_id to device_name
  onDeleteMessage?: (id: number) => void;
}

export function MessageList({
  messages,
  showDeviceName = false,
  deviceMap,
  onDeleteMessage,
}: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-muted-foreground">暂无消息</p>
      </div>
    );
  }

  // Group messages by date
  const messageGroups = groupMessagesByDate(messages as SmsMessage[]);

  return (
    <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
      <div className="py-4 space-y-4">
        {messageGroups.map((group) => (
          <div key={group.date}>
            {/* Date header */}
            <div className="flex justify-center mb-4">
              <div className="px-3 py-1 bg-muted rounded-full text-xs text-muted-foreground">
                {formatDateHeader(group.date)}
              </div>
            </div>

            {/* Messages */}
            <div className="space-y-1">
              {group.messages.map((message) => {
                const deviceName = showDeviceName && deviceMap
                  ? deviceMap.get(message.device_id)
                  : undefined;

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    deviceName={deviceName}
                    showDeviceName={showDeviceName}
                    onDelete={onDeleteMessage}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}
