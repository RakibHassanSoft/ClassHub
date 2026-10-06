'use client';

import { BellRing, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DAYS_SHORT, cn } from '@/lib/utils';

export interface TimeGroup {
  days: number[];
  start: string;
  end: string;
}

export const emptyTimeGroup = (): TimeGroup => ({ days: [], start: '10:00', end: '11:30' });

/** Turns the groups into routine rows for the API (one row per day). */
export const toSchedule = (groups: TimeGroup[]) =>
  groups.flatMap((g) => (g.start && g.end ? g.days.map((day) => ({ day, startTime: g.start, endTime: g.end })) : []));

export const scheduleError = (groups: TimeGroup[]) =>
  groups.some((g) => g.days.length > 0 && (!g.start || !g.end || g.end <= g.start)) ? 'End time must be after the start time' : null;

/** Pick the weekdays and the start/end time of the class. */
export const ClassTimesEditor = ({ value, onChange }: { value: TimeGroup[]; onChange: (v: TimeGroup[]) => void }) => {
  const update = (i: number, patch: Partial<TimeGroup>) => onChange(value.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const error = scheduleError(value);
  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div>
        <p className="text-sm font-semibold text-slate-800">Class times</p>
        <p className="mt-0.5 flex items-start gap-1.5 text-xs text-slate-500">
          <BellRing className="text-brand-600 mt-px size-3.5 shrink-0" />
          You and your students get a reminder the evening before and 1 hour before each class. You can change this later.
        </p>
      </div>
      {value.map((g, i) => (
        <div key={i} className="relative space-y-2.5 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          {value.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute top-2 right-2 grid size-7 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Remove class time"
            >
              <X className="size-4" />
            </button>
          )}
          <div className="flex flex-wrap gap-1.5 pr-8" role="group" aria-label="Class days">
            {DAYS_SHORT.map((d, day) => {
              const on = g.days.includes(day);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update(i, { days: on ? g.days.filter((x) => x !== day) : [...g.days, day].sort() })}
                  className={cn(
                    'h-8 min-w-11 cursor-pointer rounded-lg px-2 text-xs font-bold transition',
                    on ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-slate-500">
              Starts
              <Input type="time" value={g.start} onChange={(e) => update(i, { start: e.target.value })} className="mt-1" aria-label="Start time" />
            </label>
            <label className="text-xs font-medium text-slate-500">
              Ends
              <Input type="time" value={g.end} onChange={(e) => update(i, { end: e.target.value })} className="mt-1" aria-label="End time" />
            </label>
          </div>
        </div>
      ))}
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      {value.length < 4 && (
        <button
          type="button"
          onClick={() => onChange([...value, emptyTimeGroup()])}
          className="text-brand-700 flex cursor-pointer items-center gap-1.5 text-sm font-semibold hover:underline"
        >
          <Plus className="size-4" /> Add a different time (e.g. lab)
        </button>
      )}
    </div>
  );
};
