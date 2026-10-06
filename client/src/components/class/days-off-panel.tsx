'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarX2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { del, errorMessage, post } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { DAYS, formatIsoDate, todayIso, weekdayOfIso } from '@/lib/utils';
import { useReminders } from './reminders-card';
import type { RoutineSlot } from '@/lib/types';

const clock12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const dayIndex = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** Cancelled classes (no reminders are sent for them) + teacher button to cancel one. */
export const DaysOffPanel = ({ classId, slots, isTeacher }: { classId: string; slots: RoutineSlot[]; isTeacher: boolean }) => {
  const qc = useQueryClient();
  const { data } = useReminders(classId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: todayIso(), slotId: '', reason: '', notify: true });
  const [busy, setBusy] = useState(false);
  const daySlots = slots.filter((s) => s.day === dayIndex(form.date)).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['class', classId, 'reminders'] });
    qc.invalidateQueries({ queryKey: ['class', classId, 'notices'] });
    qc.invalidateQueries({ queryKey: ['notices'] });
  };

  const submit = async () => {
    setBusy(true);
    try {
      await post(`/classes/${classId}/reminders/days-off`, {
        date: form.date,
        slotId: form.slotId || undefined,
        reason: form.reason.trim() || undefined,
        notify: form.notify,
      });
      toast.success(form.notify ? 'Class cancelled. Students have been told.' : 'Class cancelled');
      setOpen(false);
      setForm({ date: todayIso(), slotId: '', reason: '', notify: true });
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string) => {
    try {
      await del(`/classes/${classId}/reminders/days-off/${id}`);
      toast.success('Class restored — reminders will be sent again');
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const offs = data?.daysOff ?? [];
  const r = data?.settings;

  return (
    <>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <BellRing className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">Class reminders</p>
              <p className="text-xs text-slate-500">
                {!r
                  ? '…'
                  : !r.enabled
                    ? 'Turned off for this class'
                    : [r.nightBefore && `the evening before at ${clock12(r.nightTime)}`, r.beforeClass && `${r.minutesBefore} min before class`]
                        .filter(Boolean)
                        .join(' and ')
                        .replace(/^./, (c) => c.toUpperCase()) || 'No reminders selected'}
                {isTeacher && (
                  <>
                    {' · '}
                    <Link href={`/classes/${classId}/settings`} className="text-brand-700 font-semibold hover:underline">
                      Change
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
          {isTeacher && slots.length > 0 && (
            <Button variant="outline" onClick={() => setOpen(true)}>
              <CalendarX2 /> Cancel a class
            </Button>
          )}
        </div>
        {offs.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {offs.map((o) => (
              <li key={o._id} className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50/60 px-3 py-2.5 ring-1 ring-rose-100">
                <CalendarX2 className="size-4 shrink-0 text-rose-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    No class · {weekdayOfIso(o.date)} {formatIsoDate(o.date)}
                    {o.slot ? ` · ${clock12(o.slot.startTime)}` : ' · whole day'}
                  </p>
                  {o.reason && <p className="text-xs text-slate-500">{o.reason}</p>}
                </div>
                {isTeacher && (
                  <button
                    type="button"
                    onClick={() => restore(o._id)}
                    className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white"
                  >
                    <RotateCcw className="size-3.5" /> Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel a class"
        description="Students get a notice now, and no reminders are sent for that class."
        icon={<CalendarX2 />}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button variant="danger" onClick={submit} loading={busy}>
              Cancel class
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Date">
            <Input type="date" min={todayIso()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, slotId: '' })} />
          </Field>
          <Field
            label="Which class"
            hint={daySlots.length ? undefined : `There is no class on ${DAYS[dayIndex(form.date)]} in your routine.`}
          >
            <Select value={form.slotId} onChange={(e) => setForm({ ...form, slotId: e.target.value })}>
              <option value="">All classes that day</option>
              {daySlots.map((s) => (
                <option key={s._id} value={s._id}>
                  {clock12(s.startTime)} – {clock12(s.endTime)}
                  {s.room ? ` · ${s.room}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason (optional)">
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={300} placeholder="e.g. I am at a conference. The class will be made up on Saturday." />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" className="size-4 accent-emerald-600" checked={form.notify} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
            Tell students now (notice + phone notification)
          </label>
        </div>
      </Dialog>
    </>
  );
};
