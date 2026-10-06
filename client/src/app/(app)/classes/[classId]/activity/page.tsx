'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown, History } from 'lucide-react';
import { useClassContext } from '@/components/class/class-context';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { get } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import type { AuditEntry } from '@/lib/types';

const FILTERS = [
  ['', 'All'],
  ['attendance', 'Attendance'],
  ['marks', 'Marks'],
  ['roster', 'Students'],
  ['member', 'Accounts'],
  ['notice', 'Notices'],
] as const;

const ENTITY_COLOR: Record<string, string> = {
  attendance: 'emerald',
  marks: 'violet',
  roster: 'sky',
  member: 'amber',
  notice: 'rose',
  class: 'slate',
};
const ACTION_COLOR: Record<string, string> = { create: 'bg-emerald-500', update: 'bg-sky-500', delete: 'bg-rose-500' };

const Entry = ({ e }: { e: AuditEntry }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative pb-6 pl-8 last:pb-0">
      <span className="absolute top-1.5 bottom-0 left-[7px] w-px bg-slate-200 group-last:hidden" />
      <span className={cn('absolute top-1.5 left-0 size-[15px] rounded-full ring-4 ring-white', ACTION_COLOR[e.action])} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={ENTITY_COLOR[e.entity]} className="capitalize">
          {e.entity === 'roster' ? 'Students' : e.entity === 'member' ? 'Account' : e.entity}
        </Badge>
        <span className="text-xs text-slate-400">
          {e.user?.name} · {timeAgo(e.createdAt)} ·{' '}
          {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-800">{e.summary}</p>
      {e.changes.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-brand-600 hover:text-brand-700 mt-1 flex cursor-pointer items-center gap-1 text-xs font-semibold"
          >
            <ChevronDown className={cn('size-3.5 transition', open && 'rotate-180')} />
            {open ? 'Hide' : 'Show'} {e.changes.length} change{e.changes.length > 1 ? 's' : ''}
          </button>
          {open && (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {e.changes.map((c, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-700">{c.label}</td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                        <span className="text-rose-600 line-through decoration-rose-300">{c.from || '–'}</span>
                        <span className="mx-1.5 text-slate-400">→</span>
                        <span className="font-semibold text-emerald-700">{c.to || '–'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </li>
  );
};

export default function ActivityPage() {
  const { classroom, isTeacher } = useClassContext();
  const [entity, setEntity] = useState('');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['class', classroom._id, 'audit', entity],
    queryFn: ({ pageParam }) =>
      get<{ items: AuditEntry[]; hasMore: boolean }>(`/classes/${classroom._id}/audit`, {
        entity: entity || undefined,
        before: pageParam || undefined,
        limit: 30,
      }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.hasMore ? last.items.at(-1)?.createdAt : undefined),
    enabled: isTeacher,
  });

  if (!isTeacher) return <EmptyState title="Only teachers can see the activity log" />;
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Card>
      <CardHeader
        title="Activity log"
        description="Every change to attendance, marks and the class list — who did it and when."
        icon={<History />}
      />
      <div className="flex flex-wrap gap-2 px-5 pt-4 sm:px-6">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setEntity(k)}
            className={cn(
              'cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition',
              entity === k ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-5 sm:p-6">
        {isLoading ? (
          <PageLoader />
        ) : !items.length ? (
          <EmptyState icon={<History />} title="No activity yet" description="Changes you make will be recorded here automatically." />
        ) : (
          <>
            <ul>
              {items.map((e) => (
                <Entry key={e._id} e={e} />
              ))}
            </ul>
            {hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                  Load older activity
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
