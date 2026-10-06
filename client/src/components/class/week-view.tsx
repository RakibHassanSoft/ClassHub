'use client';

import Link from 'next/link';
import { Clock, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Menu } from '@/components/ui/menu';
import { SLOT_META } from '@/lib/meta';
import { swatch, tone } from '@/lib/colors';
import { cn, DAYS, formatTime } from '@/lib/utils';
import type { RoutineSlot } from '@/lib/types';

/** Saturday first — common for universities in Bangladesh. Change here if needed. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export const WeekView = ({
  slots,
  showClass,
  onEdit,
  onDelete,
}: {
  slots: RoutineSlot[];
  showClass?: boolean;
  onEdit?: (s: RoutineSlot) => void;
  onDelete?: (s: RoutineSlot) => void;
}) => {
  const today = new Date().getDay();
  const byDay = (d: number) => slots.filter((s) => s.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {WEEK_ORDER.map((d) => {
        const items = byDay(d);
        const isToday = d === today;
        return (
          <div
            key={d}
            className={cn(
              'shadow-soft flex min-h-32 flex-col rounded-2xl border bg-white p-3',
              isToday ? 'border-brand-300 ring-brand-100 ring-2' : 'border-slate-200/80',
              items.length === 0 && 'hidden sm:flex',
            )}
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <p className={cn('text-sm font-bold', isToday ? 'text-brand-700' : 'text-slate-800')}>{DAYS[d]}</p>
              {isToday && <span className="bg-brand-500 rounded-full px-2 py-0.5 text-[10px] font-bold text-white uppercase">Today</span>}
            </div>
            <div className="flex-1 space-y-2">
              {items.length === 0 && <p className="px-1 text-xs text-slate-400">No class</p>}
              {items.map((s) => {
                const cls = typeof s.classroom === 'string' ? null : s.classroom;
                const meta = SLOT_META[s.type];
                const body = (
                  <div className="relative rounded-xl bg-slate-50 p-2.5 pl-3.5 ring-1 ring-slate-200/70 transition hover:bg-slate-100/70">
                    <span className={cn('absolute inset-y-2 left-1 w-1 rounded-full', tone(swatch, cls?.color ?? meta.color))} />
                    {showClass && cls && <p className="truncate text-[13px] font-bold text-slate-800">{cls.courseCode || cls.title}</p>}
                    <p className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <Clock className="size-3 text-slate-400" />
                      {formatTime(s.startTime)} – {formatTime(s.endTime)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge color={meta.color} className="px-2 text-[10px]">
                        {meta.label}
                      </Badge>
                      {s.room && (
                        <span className="flex items-center gap-0.5 text-[11px] text-slate-500">
                          <MapPin className="size-3" />
                          {s.room}
                        </span>
                      )}
                    </div>
                    {s.note && <p className="mt-1 text-[11px] text-slate-500">{s.note}</p>}
                    {onEdit && onDelete && (
                      <div className="absolute top-1 right-1">
                        <Menu
                          items={[
                            { label: 'Edit', icon: <Pencil />, onClick: () => onEdit(s) },
                            { label: 'Delete', icon: <Trash2 />, onClick: () => onDelete(s), danger: true },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                );
                return showClass && cls ? (
                  <Link key={s._id} href={`/classes/${cls._id}`} className="block">
                    {body}
                  </Link>
                ) : (
                  <div key={s._id}>{body}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
