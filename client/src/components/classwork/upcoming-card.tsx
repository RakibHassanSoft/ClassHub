'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Hourglass } from 'lucide-react';
import { useUpcoming } from '@/hooks/queries';
import { Card, CardHeader } from '@/components/ui/card';
import { CLASSWORK_META, formatDateTime, relativeTime } from '@/lib/meta';
import { cn } from '@/lib/utils';

/** Dashboard: homework deadlines and class tests coming up across every class. */
export const UpcomingCard = () => {
  const { data } = useUpcoming();
  const [now] = useState(() => Date.now());
  const items = (data ?? []).slice(0, 6);
  return (
    <Card>
      <CardHeader title="Coming up" description="Deadlines and class tests" icon={<Hourglass />} />
      <div className="p-3 pt-4">
        {!items.length ? (
          <p className="px-3 pb-3 text-sm text-slate-500">No upcoming deadlines or class tests.</p>
        ) : (
          items.map((u) => {
            const meta = CLASSWORK_META[u.type];
            const soon = new Date(u.at).getTime() - now < 24 * 3600_000;
            return (
              <Link
                key={u._id}
                href={u.classroom ? `/classes/${u.classroom._id}/classwork?item=${u._id}` : '#'}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl ring-1 [&_svg]:size-4', meta.tone)}>
                  {meta.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{u.title}</span>
                  <span className={cn('block truncate text-xs', soon ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                    {u.classroom?.courseCode || u.classroom?.title} · {u.type === 'homework' ? 'due' : ''} {formatDateTime(u.at)} (
                    {relativeTime(u.at)})
                  </span>
                </span>
                {u.submitted && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />}
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
};
