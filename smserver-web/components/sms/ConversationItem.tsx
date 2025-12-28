'use client';

import { Conversation, GlobalConversation } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatConversationTime, truncateMessage } from '@/lib/conversation-utils';
import { cn } from '@/lib/utils';
import { Circle } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation | GlobalConversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  // Check if it's a global conversation
  const isGlobal = 'devices' in conversation;
  const globalConv = conversation as GlobalConversation;

  // Get first letter of contact name for avatar
  const firstLetter = conversation.contactName?.[0]?.toUpperCase() || '#';

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-primary/10 hover:bg-primary/10 dark:bg-primary/15 dark:hover:bg-primary/15'
          : 'hover:bg-accent/50'
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarFallback className="text-lg bg-primary/15 text-primary dark:bg-primary/20">
          {firstLetter}
        </AvatarFallback>
      </Avatar>

      {/* Conversation info */}
      <div className="flex-1 min-w-0">
        {/* Top row: Name and time */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={cn(
                'font-medium truncate',
                conversation.unreadCount > 0 && 'font-semibold'
              )}
            >
              {conversation.contactName}
            </span>
            {conversation.unreadCount > 0 && (
              <Circle className="h-2 w-2 fill-blue-600 text-blue-600 flex-shrink-0" />
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatConversationTime(conversation.lastMessageTime)}
          </span>
        </div>

        {/* Middle row: Last message */}
        <p
          className={cn(
            'text-sm text-muted-foreground truncate mb-1',
            conversation.unreadCount > 0 && 'font-medium text-foreground'
          )}
        >
          {truncateMessage(conversation.lastMessage, 40)}
        </p>

        {/* Bottom row: Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Unread count */}
          {conversation.unreadCount > 0 && (
            <Badge variant="default" className="h-5 text-xs">
              {conversation.unreadCount} 未读
            </Badge>
          )}

          {/* Device names (for global conversation) */}
          {isGlobal && globalConv.deviceNames.length > 0 && (
            <div className="flex items-center gap-1">
              {globalConv.deviceNames.map((name, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="h-5 text-xs bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/15 dark:hover:bg-primary/20"
                >
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
