'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { ConversationList } from '@/components/chat/conversation-list';
import { cn } from '@/lib/utils';

export default function MessagesLayout({ children }: { children: ReactNode }) {
  const { conversationId } = useParams<{ conversationId?: string }>();
  return (
    <div className="lg:shadow-card -mx-4 -mt-6 -mb-28 flex h-[calc(100dvh-4rem-64px-env(safe-area-inset-bottom))] overflow-hidden border-slate-200/80 bg-white sm:-mx-6 lg:mx-0 lg:mt-0 lg:mb-0 lg:h-[calc(100dvh-4rem-3rem)] lg:rounded-2xl lg:border">
      <aside className={cn('w-full shrink-0 border-r border-slate-200/80 md:w-80 lg:w-96', conversationId ? 'hidden md:block' : 'block')}>
        <ConversationList activeId={conversationId} />
      </aside>
      <section className={cn('min-w-0 flex-1', conversationId ? 'flex' : 'hidden md:flex')}>{children}</section>
    </div>
  );
}
