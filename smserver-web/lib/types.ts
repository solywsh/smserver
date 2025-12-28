import { SmsMessage } from './api';

/**
 * Conversation represents a grouped chat thread with a specific contact/number
 */
export interface Conversation {
  address: string;          // Phone number (unique identifier)
  contactName: string;      // Contact name or phone number if no name
  lastMessage: string;      // Last message content
  lastMessageTime: number;  // Last message timestamp (milliseconds)
  unreadCount: number;      // Number of unread messages
  messageCount: number;     // Total number of messages
}

/**
 * Global conversation (for /sms page) extends Conversation with device info
 */
export interface GlobalConversation extends Conversation {
  devices: number[];        // List of device IDs involved in this conversation
  deviceNames: string[];    // List of device names for display
}

/**
 * Message group by date for display
 */
export interface MessageGroup {
  date: string;             // Date in YYYY-MM-DD format
  messages: SmsMessage[];   // Messages on this date
}

/**
 * View mode for SMS pages
 */
export type SmsViewMode = 'list' | 'conversation';

/**
 * SIM slot identifier
 */
export type SimSlot = 0 | 1; // 0 = SIM1, 1 = SIM2
