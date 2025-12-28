'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { List, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmsViewMode } from '@/lib/types';

interface ViewToggleProps {
  currentView: SmsViewMode;
  className?: string;
}

export function ViewToggle({ currentView, className }: ViewToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleViewChange = (view: SmsViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className={cn('inline-flex items-center rounded-md border bg-muted p-1', className)}>
      <Button
        variant={currentView === 'list' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn(
          'flex items-center gap-2',
          currentView === 'list' && 'bg-background shadow-sm'
        )}
        onClick={() => handleViewChange('list')}
      >
        <List className="h-4 w-4" />
        <span>List View</span>
      </Button>
      <Button
        variant={currentView === 'conversation' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn(
          'flex items-center gap-2',
          currentView === 'conversation' && 'bg-background shadow-sm'
        )}
        onClick={() => handleViewChange('conversation')}
      >
        <MessageSquare className="h-4 w-4" />
        <span>Chat View</span>
      </Button>
    </div>
  );
}
