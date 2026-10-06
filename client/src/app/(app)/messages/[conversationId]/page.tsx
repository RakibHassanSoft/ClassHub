'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { useConversation } from '@/hooks/queries';
import { ChatThread } from '@/components/chat/chat-thread';
import { Avatar } from '@/components/ui/misc';
import { swatch, tone } from '@/lib/colors';
import { cn } from '@/lib/utils';

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const me = useAuth((s) => s.user);
  const { data: conv } = useConversation(conversationId);
  const other = conv?.participants.find((p) => p._id !== me?._id);
  const title =
    conv?.type === 'class'
      ? conv.classroom.courseCode
        ? `${conv.classroom.courseCode} · ${conv.classroom.title}`
        : conv.classroom.title
      : other?.name;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200/80 px-3 py-3 sm:px-5">
        <Link
          href="/messages"
          className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        {conv?.type === 'class' ? (
          <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-white', tone(swatch, conv.classroom.color))}>
            <Users className="size-[18px]" />
          </div>
        ) : (
          <Avatar name={other?.name} />
        )}
        <div className="min-w-0">
          <p className="font-display truncate font-bold text-slate-900">{title ?? '…'}</p>
          <p className="truncate text-xs text-slate-500">
            {conv?.type === 'class'
              ? 'Class group · everyone in the class'
              : other
                ? `${other.role === 'teacher' ? 'Teacher' : (other.studentId ?? 'Student')} · ${conv?.classroom.courseCode || conv?.classroom.title}`
                : ''}
          </p>
        </div>
        {conv && (
          <Link
            href={`/classes/${conv.classroom._id}`}
            className="text-brand-600 hover:text-brand-700 ml-auto hidden text-sm font-semibold sm:block"
          >
            Open class
          </Link>
        )}
      </header>
      <ChatThread key={conversationId} conversationId={conversationId} />
    </div>
  );
}
