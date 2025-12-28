'use client';

import { SmsMessage, SmsMessageWithDevice, Device } from '@/lib/api';
import { Conversation, GlobalConversation } from '@/lib/types';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';

interface ConversationPanelProps {
  conversation: Conversation | GlobalConversation | null;
  messages: SmsMessage[] | SmsMessageWithDevice[];
  deviceId?: number; // For device-specific page
  devices?: Device[]; // For global page
  deviceMap?: Map<number, string>; // For global page
  onDeleteConversation?: () => void;
  onMarkAllRead?: () => void;
  onDeleteMessage?: (id: number) => void;
  onMessageSent?: () => void;
}

export function ConversationPanel({
  conversation,
  messages,
  deviceId,
  devices,
  deviceMap,
  onDeleteConversation,
  onMarkAllRead,
  onDeleteMessage,
  onMessageSent,
}: ConversationPanelProps) {
  // No conversation selected
  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-muted-foreground">
            请选择一个会话
          </p>
          <p className="text-sm text-muted-foreground">
            从左侧列表中选择联系人开始聊天
          </p>
        </div>
      </div>
    );
  }

  const showDeviceName = Boolean(devices && deviceMap);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <ConversationHeader
        conversation={conversation}
        onDeleteConversation={onDeleteConversation}
        onMarkAllRead={onMarkAllRead}
      />

      {/* Message list */}
      <MessageList
        messages={messages}
        showDeviceName={showDeviceName}
        deviceMap={deviceMap}
        onDeleteMessage={onDeleteMessage}
      />

      {/* Composer */}
      <div className="p-4 border-t bg-background">
        <MessageComposer
          address={conversation.address}
          deviceId={deviceId}
          devices={devices}
          onSent={onMessageSent}
        />
      </div>
    </div>
  );
}
