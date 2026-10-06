'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock, Moon, Save, Send, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, get, patch, post } from '@/lib/api';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Spinner, Switch } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import type { ReminderOverview, ReminderSettings } from '@/lib/types';

const NIGHT_TIMES = ['18:00', '19:00', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];
const BEFORE = [15, 30, 45, 60, 90, 120, 180];

const clock12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const beforeLabel = (n: number) => (n % 60 === 0 ? `${n / 60} hour${n === 60 ? '' : 's'} before` : `${n} minutes before`);

export const useReminders = (classId: string) =>
  useQuery({ queryKey: ['class', classId, 'reminders'], queryFn: () => get<ReminderOverview>(`/classes/${classId}/reminders`) });

const whenLabel = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Teacher controls for the automatic class reminders. */
export const RemindersCard = ({ classId, slotCount }: { classId: string; slotCount?: number }) => {
  const qc = useQueryClient();
  const { data, isLoading } = useReminders(classId);
  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader title="Class reminders" icon={<BellRing />} />
        <CardBody className="grid place-items-center py-10">
          <Spinner />
        </CardBody>
      </Card>
    );
  }
  return (
    <RemindersForm
      key={JSON.stringify(data.settings)}
      classId={classId}
      data={data}
      slotCount={slotCount}
      onSaved={() => qc.invalidateQueries({ queryKey: ['class', classId, 'reminders'] })}
    />
  );
};

const RemindersForm = ({
  classId,
  data,
  slotCount,
  onSaved,
}: {
  classId: string;
  data: ReminderOverview;
  slotCount?: number;
  onSaved: () => void;
}) => {
  const [r, setR] = useState<ReminderSettings>(data.settings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const set = (p: Partial<ReminderSettings>) => setR((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(r) !== JSON.stringify(data.settings);

  const save = async () => {
    setSaving(true);
    try {
      await patch(`/classes/${classId}`, { settings: { reminders: r } });
      toast.success('Reminder settings saved');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await post<{ push: number }>(`/classes/${classId}/reminders/test`);
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Class reminders"
        description="Automatic notifications to students (and you) before each class — on the phone and in the app."
        icon={<BellRing />}
      />
      <CardBody className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <span className="text-sm font-semibold text-slate-800">{r.enabled ? 'Reminders are on' : 'Reminders are off'}</span>
          <Switch checked={r.enabled} onChange={(v) => set({ enabled: v })} label="Class reminders" />
        </label>
        {slotCount === 0 && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
            Add your class times in the{' '}
            <Link href={`/classes/${classId}/routine`} className="font-semibold underline">
              Routine
            </Link>{' '}
            tab so reminders know when your class starts.
          </p>
        )}
        <div className={cn('divide-y divide-slate-100 rounded-xl border border-slate-200', !r.enabled && 'pointer-events-none opacity-50')}>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <Moon className="size-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">The evening before</p>
                <p className="text-xs text-slate-500">Tomorrow&apos;s class time and room, homework due and class tests.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={r.nightTime} onChange={(e) => set({ nightTime: e.target.value })} disabled={!r.nightBefore} className="w-32" aria-label="Evening reminder time">
                {(NIGHT_TIMES.includes(r.nightTime) ? NIGHT_TIMES : [...NIGHT_TIMES, r.nightTime].sort()).map((t) => (
                  <option key={t} value={t}>
                    {clock12(t)}
                  </option>
                ))}
              </Select>
              <Switch checked={r.nightBefore} onChange={(v) => set({ nightBefore: v })} label="Evening reminder" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                <Timer className="size-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">Before the class starts</p>
                <p className="text-xs text-slate-500">&ldquo;Your class starts in {beforeLabel(r.minutesBefore).replace(' before', '')}&rdquo; with time and room</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={String(r.minutesBefore)}
                onChange={(e) => set({ minutesBefore: Number(e.target.value) })}
                disabled={!r.beforeClass}
                className="w-44"
                aria-label="Minutes before class"
              >
                {(BEFORE.includes(r.minutesBefore) ? BEFORE : [...BEFORE, r.minutesBefore].sort((a, b) => a - b)).map((n) => (
                  <option key={n} value={n}>
                    {beforeLabel(n)}
                  </option>
                ))}
              </Select>
              <Switch checked={r.beforeClass} onChange={(v) => set({ beforeClass: v })} label="Before-class reminder" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Remind teachers too</p>
              <p className="text-xs text-slate-500">You and co-teachers get the same reminders.</p>
            </div>
            <Switch checked={r.notifyTeachers} onChange={(v) => set({ notifyTeachers: v })} label="Remind teachers" />
          </div>
        </div>

        {r.enabled && data.next.length > 0 && !dirty && (
          <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
              <CalendarClock className="size-3.5" /> Next reminders
            </p>
            <ul className="space-y-1.5">
              {data.next.slice(0, 4).map((n) => (
                <li key={n.at + n.kind} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="w-36 shrink-0 font-semibold text-slate-800">{whenLabel(n.at)}</span>
                  <span className="text-slate-600">{n.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-400">Times use the {data.timezone.replace('_', ' ')} time zone. Cancelled classes are skipped.</p>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={test} loading={testing}>
            <Send /> Send me a test
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <Save /> Save reminders
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};
