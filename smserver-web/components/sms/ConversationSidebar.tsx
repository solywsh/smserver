'use client';

import { Conversation, GlobalConversation } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { ConversationList } from './ConversationList';
import { Search } from 'lucide-react';

interface ConversationSidebarProps {
  conversations: (Conversation | GlobalConversation)[];
  activeConversation: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectConversation: (address: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversation,
  searchQuery,
  onSearchChange,
  onSelectConversation,
}: ConversationSidebarProps) {
  return (
    <div className="flex flex-col h-full border-r bg-background overflow-hidden">
      {/* Search bar - matching header height */}
      <div className="p-4 border-b flex-shrink-0 h-[77px] flex items-center">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索联系人、号码或消息内容..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ConversationList
          conversations={conversations}
          activeConversation={activeConversation}
          onSelectConversation={onSelectConversation}
        />
      </div>
    </div>
  );
}
