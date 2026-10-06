'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFeed, qk } from '@/hooks/queries';
import { post } from '@/lib/api';
import { NOTICE_META } from '@/lib/meta';
import { cn, timeAgo } from '@/lib/utils';
import { Spinner } from '@/components/ui/misc';

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useFeed();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const markAll = async () => {
    await post('/notices/feed/seen-all');
    qc.invalidateQueries({ queryKey: qk.feed });
  };

  const unread = data?.unread ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-10 cursor-pointer place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] leading-[18px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-pop-in shadow-lift fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-display font-bold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-brand-600 hover:text-brand-700 flex cursor-pointer items-center gap-1 text-xs font-semibold"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] scrollbar-thin overflow-y-auto">
            {isLoading ? (
              <div className="grid place-items-center py-10">
                <Spinner />
              </div>
            ) : !data?.items.length ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No notifications yet</p>
            ) : (
              data.items.map((n) => {
                const meta = NOTICE_META[n.type];
                const cls = typeof n.classroom === 'string' ? null : n.classroom;
                return (
                  <Link
                    key={n._id}
                    href={cls ? `/classes/${cls._id}` : '/notifications'}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex gap-3 border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50',
                      !n.seen && 'bg-brand-50/40',
                    )}
                  >
                    <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4', meta.iconBg)}>{meta.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{n.title}</p>
                      <p className="truncate text-xs text-slate-500">
                        {cls?.courseCode || cls?.title} · {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.seen && <span className="bg-brand-500 mt-1.5 size-2 shrink-0 rounded-full" />}
                  </Link>
                );
              })
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-brand-600 block border-t border-slate-100 py-2.5 text-center text-sm font-semibold hover:bg-slate-50"
          >
            See all
          </Link>
        </div>
      )}
    </div>
  );
};
