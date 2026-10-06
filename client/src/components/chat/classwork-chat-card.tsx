'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, Clock, Paperclip } from 'lucide-react';
import { CLASSWORK_META, formatDateTime } from '@/lib/meta';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';

/** Card shown in chat when the teacher posts homework, a class test, syllabus or materials. */
export const ClassworkChatCard = ({ m, classId, mine }: { m: ChatMessage; classId: string; mine: boolean }) => {
  const ref = m.ref!;
  const meta = CLASSWORK_META[ref.type] ?? CLASSWORK_META.material;
  const href = ref.type === 'material' ? `/classes/${classId}/classwork?tab=material` : `/classes/${classId}/classwork?item=${ref.id}`;
  return (
    <Link
      href={href}
      className={cn(
        'hover:ring-brand-300 block w-64 max-w-full overflow-hidden rounded-xl bg-white text-left ring-1 transition sm:w-72',
        mine ? 'ring-white/40' : 'ring-slate-200',
      )}
    >
      <div className={cn('flex items-center gap-2 px-3 py-2 text-xs font-bold [&_svg]:size-4', meta.tone)}>
        {meta.icon} {meta.label}
      </div>
      <div className="space-y-1 px-3 py-2.5">
        <p className="text-sm leading-snug font-bold text-slate-900">{ref.title}</p>
        {ref.dueAt && (
          <p className="flex items-center gap-1 text-xs font-medium text-slate-600">
            <Clock className="size-3.5" /> Due {formatDateTime(ref.dueAt)}
          </p>
        )}
        {ref.eventAt && (
          <p className="flex items-center gap-1 text-xs font-medium text-slate-600">
            <CalendarClock className="size-3.5" /> {formatDateTime(ref.eventAt)}
          </p>
        )}
        {Boolean(ref.files) && (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Paperclip className="size-3.5" /> {ref.files} file{ref.files! > 1 ? 's' : ''}
          </p>
        )}
      </div>
      <div className="text-brand-700 flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs font-semibold">
        Open in Classwork <ArrowRight className="size-3.5" />
      </div>
    </Link>
  );
};
