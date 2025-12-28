'use client';

import { useState, useMemo } from 'react';
import { SmsMessage, SmsMessageWithDevice, Device } from '@/lib/api';
import { Conversation, GlobalConversation } from '@/lib/types';
import { ConversationSidebar } from './ConversationSidebar';
import { ConversationPanel } from './ConversationPanel';
import {
  generateConversations,
  generateGlobalConversations,
} from '@/lib/conversation-utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ConversationViewProps {
  messages: SmsMessage[] | SmsMessageWithDevice[];
  deviceId?: number; // For device-specific page
  devices?: Device[]; // For global page
  onRefresh?: () => void; // Callback to refresh messages
}

export function ConversationView({
  messages,
  deviceId,
  devices,
  onRefresh,
}: ConversationViewProps) {
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isGlobalMode = Boolean(devices);

  // Generate conversations from messages
  const allConversations = useMemo(() => {
    if (isGlobalMode) {
      return generateGlobalConversations(
        messages as SmsMessageWithDevice[],
        devices!
      );
    } else {
      return generateConversations(messages as SmsMessage[]);
    }
  }, [messages, isGlobalMode, devices]);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return allConversations;

    const query = searchQuery.toLowerCase();

    return allConversations.filter((conv) => {
      // Search contact name
      if (conv.contactName.toLowerCase().includes(query)) {
        return true;
      }

      // Search phone number
      if (conv.address.includes(query)) {
        return true;
      }

      // Search message content
      const conversationMessages = messages.filter(
        (msg) => msg.address === conv.address
      );
      return conversationMessages.some((msg) =>
        msg.body.toLowerCase().includes(query)
      );
    });
  }, [allConversations, searchQuery, messages]);

  // Get active conversation object
  const activeConvObject = useMemo(() => {
    if (!activeConversation) return null;
    return (
      allConversations.find((c) => c.address === activeConversation) || null
    );
  }, [activeConversation, allConversations]);

  // Get messages for active conversation
  const activeMessages = useMemo(() => {
    if (!activeConversation) return [];
    return messages.filter((msg) => msg.address === activeConversation);
  }, [activeConversation, messages]);

  // Create device map for global mode
  const deviceMap = useMemo(() => {
    if (!isGlobalMode || !devices) return undefined;
    return new Map(devices.map((d) => [d.id, d.name]));
  }, [isGlobalMode, devices]);

  // Handle conversation selection
  const handleSelectConversation = (address: string) => {
    setActiveConversation(address);
  };

  // Handle delete conversation
  const handleDeleteConversation = async () => {
    if (!activeConvObject) return;

    const messageIds = activeMessages.map((m) => m.id);

    if (messageIds.length === 0) {
      toast.error('没有消息可删除');
      return;
    }

    const confirmed = window.confirm(
      `确定要删除与 ${activeConvObject.contactName} 的所有 ${messageIds.length} 条消息吗？此操作不可恢复。`
    );

    if (!confirmed) return;

    const res = await api.deleteMultipleSms(messageIds);

    if (res.data) {
      toast.success('会话已删除');
      setActiveConversation(null);
      onRefresh?.();
    } else {
      toast.error(res.error || '删除失败');
    }
  };

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    if (!activeConvObject) return;

    const unreadMessages = activeMessages.filter((m) => !m.is_read);

    if (unreadMessages.length === 0) {
      toast.info('没有未读消息');
      return;
    }

    // Mark each message as read
    const promises = unreadMessages.map((msg) => api.markSmsAsRead(msg.id));
    const results = await Promise.all(promises);

    const successCount = results.filter((r) => r.data).length;

    if (successCount > 0) {
      toast.success(`已标记 ${successCount} 条消息为已读`);
      onRefresh?.();
    } else {
      toast.error('标记失败');
    }
  };

  // Handle delete single message
  const handleDeleteMessage = async (id: number) => {
    const confirmed = window.confirm('确定要删除这条消息吗？此操作不可恢复。');

    if (!confirmed) return;

    const res = await api.deleteMultipleSms([id]);

    if (res.data) {
      toast.success('消息已删除');
      onRefresh?.();
    } else {
      toast.error(res.error || '删除失败');
    }
  };

  // Handle message sent
  const handleMessageSent = () => {
    onRefresh?.();
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-lg border overflow-hidden">
      {/* Left sidebar: Conversation list (30%) */}
      <div className="w-[30%] min-w-[280px]">
        <ConversationSidebar
          conversations={filteredConversations}
          activeConversation={activeConversation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Right panel: Conversation messages (70%) */}
      <div className="flex-1">
        <ConversationPanel
          conversation={activeConvObject}
          messages={activeMessages}
          deviceId={deviceId}
          devices={devices}
          deviceMap={deviceMap}
          onDeleteConversation={handleDeleteConversation}
          onMarkAllRead={handleMarkAllRead}
          onDeleteMessage={handleDeleteMessage}
          onMessageSent={handleMessageSent}
        />
      </div>
    </div>
  );
}
