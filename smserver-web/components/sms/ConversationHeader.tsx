'use client';

import { Conversation, GlobalConversation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCheck, MoreVertical, Trash2 } from 'lucide-react';

interface ConversationHeaderProps {
  conversation: Conversation | GlobalConversation;
  onDeleteConversation?: () => void;
  onMarkAllRead?: () => void;
}

export function ConversationHeader({
  conversation,
  onDeleteConversation,
  onMarkAllRead,
}: ConversationHeaderProps) {
  // Check if it's a global conversation
  const isGlobal = 'devices' in conversation;
  const globalConv = conversation as GlobalConversation;

  // Get first letter of contact name for avatar
  const firstLetter = conversation.contactName?.[0]?.toUpperCase() || '#';

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background h-[77px]">
      {/* Left: Contact info */}
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{firstLetter}</AvatarFallback>
        </Avatar>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{conversation.contactName}</h2>
            {conversation.unreadCount > 0 && (
              <Badge variant="default" className="h-5 text-xs">
                {conversation.unreadCount} 未读
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-sm text-muted-foreground">{conversation.address}</p>
            {/* Device badges (for global conversation) */}
            {isGlobal && globalConv.deviceNames.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground mx-1">•</span>
                {globalConv.deviceNames.map((name, idx) => (
                  <Badge key={idx} variant="secondary" className="h-5 text-xs">
                    {name}
                  </Badge>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onMarkAllRead && conversation.unreadCount > 0 && (
            <DropdownMenuItem onClick={onMarkAllRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              标记已读
            </DropdownMenuItem>
          )}
          {onDeleteConversation && (
            <DropdownMenuItem
              onClick={onDeleteConversation}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除会话
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
