'use client';

import { AiSummary } from '@/components/ai/ai-summary';
import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useFeed, qk } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { post } from '@/lib/api';
import { NOTICE_META } from '@/lib/meta';
import { cn, timeAgo } from '@/lib/utils';

export default function NotificationsPage() {
  const { data, isLoading } = useFeed();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const markAll = async () => {
    await post('/notices/feed/seen-all');
    qc.invalidateQueries({ queryKey: qk.feed });
  };

  const items = (data?.items ?? []).filter((n) => filter === 'all' || !n.seen);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Notifications</h1>
          <p className="mt-1 text-slate-500">Notices and class reminders from all your classes</p>
        </div>
        {(data?.unread ?? 0) > 0 && (
          <Button variant="outline" onClick={markAll}>
            <CheckCheck /> Mark all read
          </Button>
        )}
      </div>

      <div className="inline-flex rounded-xl bg-slate-100 p-1">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition',
              filter === f ? 'shadow-soft bg-white text-slate-900' : 'text-slate-500',
            )}
          >
            {f} {f === 'unread' && data?.unread ? `(${data.unread})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !items.length ? (
        <Card>
          <EmptyState icon={<Bell />} title={filter === 'unread' ? 'You are all caught up' : 'No notifications yet'} />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const meta = NOTICE_META[n.type];
            const cls = typeof n.classroom === 'string' ? null : n.classroom;
            return (
              <Card key={n._id} className={cn('p-4 sm:p-5', !n.seen && 'border-brand-200 bg-brand-50/30')}>
                <div className="flex gap-3.5">
                  <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]', meta.iconBg)}>
                    {meta.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={meta.color}>{meta.label}</Badge>
                      {cls && (
                        <Link href={`/classes/${cls._id}`} className="hover:text-brand-700 text-xs font-semibold text-slate-600">
                          {cls.courseCode ? `${cls.courseCode} · ${cls.title}` : cls.title}
                        </Link>
                      )}
                      <span className="text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 font-bold text-slate-900">{n.title}</p>
                    <AiSummary text={n.summary} className="mt-2" />
                    {n.body && <p className="mt-1.5 line-clamp-3 text-sm whitespace-pre-line text-slate-600">{n.body}</p>}
                    {n.link && n.kind === 'reminder' && (
                      <Link href={n.link} className="text-brand-700 mt-2 inline-flex items-center gap-1 text-xs font-semibold">
                        Open class
                      </Link>
                    )}
                    {n.link && n.kind !== 'reminder' && (
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-700 mt-2 inline-flex items-center gap-1 text-xs font-semibold"
                      >
                        <ExternalLink className="size-3.5" /> Open link
                      </a>
                    )}
                  </div>
                  {!n.seen && <span className="bg-brand-500 mt-1.5 size-2.5 shrink-0 rounded-full" />}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
