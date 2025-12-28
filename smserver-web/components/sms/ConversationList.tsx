'use client';

import { Conversation, GlobalConversation } from '@/lib/types';
import { ConversationItem } from './ConversationItem';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConversationListProps {
  conversations: (Conversation | GlobalConversation)[];
  activeConversation: string | null;
  onSelectConversation: (address: string) => void;
}

export function ConversationList({
  conversations,
  activeConversation,
  onSelectConversation,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-muted-foreground">暂无会话</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-1">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.address}
            conversation={conversation}
            isActive={activeConversation === conversation.address}
            onClick={() => onSelectConversation(conversation.address)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
