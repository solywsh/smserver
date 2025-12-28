import { SmsMessage, SmsMessageWithDevice, Device } from './api';
import { Conversation, GlobalConversation, MessageGroup } from './types';

/**
 * Generate conversations from SMS messages (for device-specific page)
 * Groups messages by address and sorts by last message time
 */
export function generateConversations(messages: SmsMessage[]): Conversation[] {
  const conversationMap = new Map<string, Conversation>();

  messages.forEach((msg) => {
    const existing = conversationMap.get(msg.address);

    if (!existing) {
      conversationMap.set(msg.address, {
        address: msg.address,
        contactName: msg.name || msg.address,
        lastMessage: msg.body,
        lastMessageTime: msg.sms_time,
        unreadCount: msg.is_read ? 0 : 1,
        messageCount: 1,
      });
    } else {
      // Update last message if this message is newer
      if (msg.sms_time > existing.lastMessageTime) {
        existing.lastMessage = msg.body;
        existing.lastMessageTime = msg.sms_time;
        existing.contactName = msg.name || msg.address;
      }

      if (!msg.is_read) {
        existing.unreadCount++;
      }

      existing.messageCount++;
    }
  });

  // Sort by last message time (newest first)
  return Array.from(conversationMap.values()).sort(
    (a, b) => b.lastMessageTime - a.lastMessageTime
  );
}

/**
 * Generate global conversations from messages with device info (for global /sms page)
 * Groups messages by address across devices
 */
export function generateGlobalConversations(
  messages: SmsMessageWithDevice[],
  devices: Device[]
): GlobalConversation[] {
  const conversationMap = new Map<string, GlobalConversation>();
  const deviceMap = new Map(devices.map((d) => [d.id, d.name]));

  messages.forEach((msg) => {
    const existing = conversationMap.get(msg.address);

    if (!existing) {
      conversationMap.set(msg.address, {
        address: msg.address,
        contactName: msg.name || msg.address,
        lastMessage: msg.body,
        lastMessageTime: msg.sms_time,
        unreadCount: msg.is_read ? 0 : 1,
        messageCount: 1,
        devices: [msg.device_id],
        deviceNames: [deviceMap.get(msg.device_id) || msg.device_name],
      });
    } else {
      // Update last message if this message is newer
      if (msg.sms_time > existing.lastMessageTime) {
        existing.lastMessage = msg.body;
        existing.lastMessageTime = msg.sms_time;
        existing.contactName = msg.name || msg.address;
      }

      if (!msg.is_read) {
        existing.unreadCount++;
      }

      existing.messageCount++;

      // Add device if not already in the list
      if (!existing.devices.includes(msg.device_id)) {
        existing.devices.push(msg.device_id);
        existing.deviceNames.push(deviceMap.get(msg.device_id) || msg.device_name);
      }
    }
  });

  // Sort by last message time (newest first)
  return Array.from(conversationMap.values()).sort(
    (a, b) => b.lastMessageTime - a.lastMessageTime
  );
}

/**
 * Group messages by date for display
 */
export function groupMessagesByDate(messages: SmsMessage[]): MessageGroup[] {
  const groups = new Map<string, SmsMessage[]>();

  // Sort messages by time (oldest first for chronological order)
  const sortedMessages = [...messages].sort((a, b) => a.sms_time - b.sms_time);

  sortedMessages.forEach((msg) => {
    const date = new Date(msg.sms_time).toISOString().split('T')[0];
    const existing = groups.get(date);

    if (existing) {
      existing.push(msg);
    } else {
      groups.set(date, [msg]);
    }
  });

  // Convert to array and sort by date (oldest first)
  return Array.from(groups.entries())
    .map(([date, messages]) => ({ date, messages }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Format timestamp for conversation list display
 * Returns: "今天", "昨天", "MM/DD", or "YYYY/MM/DD"
 */
export function formatConversationTime(timestamp: number): string {
  const now = new Date();
  const msgDate = new Date(timestamp);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const msgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return '今天';
  } else if (msgDay.getTime() === yesterday.getTime()) {
    return '昨天';
  } else if (msgDate.getFullYear() === now.getFullYear()) {
    return `${msgDate.getMonth() + 1}/${msgDate.getDate()}`;
  } else {
    return `${msgDate.getFullYear()}/${msgDate.getMonth() + 1}/${msgDate.getDate()}`;
  }
}

/**
 * Format timestamp for message bubble display
 * Returns: "HH:MM"
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format date header for message list
 * Returns: "今天", "昨天", "YYYY年MM月DD日"
 */
export function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return '今天';
  } else if (msgDay.getTime() === yesterday.getTime()) {
    return '昨天';
  } else {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
}

/**
 * Get SIM card label
 */
export function getSimLabel(simId: number): string {
  if (simId === 0) return 'SIM 1';
  if (simId === 1) return 'SIM 2';
  return 'SIM';
}

/**
 * Truncate message content for preview
 */
export function truncateMessage(content: string, maxLength: number = 50): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}
