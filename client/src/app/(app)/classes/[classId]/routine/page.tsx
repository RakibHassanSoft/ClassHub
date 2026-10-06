'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useClassContext } from '@/components/class/class-context';
import { WEEK_ORDER, WeekView } from '@/components/class/week-view';
import { DaysOffPanel } from '@/components/class/days-off-panel';
import { qk, useRoutine } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { del, errorMessage, patch, post } from '@/lib/api';
import { SLOT_META } from '@/lib/meta';
import { DAYS } from '@/lib/utils';
import type { RoutineSlot, SlotType } from '@/lib/types';

const empty = { day: 0, startTime: '09:00', endTime: '10:30', room: '', type: 'theory' as SlotType, note: '' };

export default function RoutinePage() {
  const { classroom, isTeacher } = useClassContext();
  const id = classroom._id;
  const qc = useQueryClient();
  const { data, isLoading } = useRoutine(id);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoutineSlot | null>(null);
  const [form, setForm] = useState(empty);
  const [deleting, setDeleting] = useState<RoutineSlot | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.routine(id) });
    qc.invalidateQueries({ queryKey: qk.myWeek });
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, room: classroom.room ?? '' });
    setOpen(true);
  };
  const openEdit = (s: RoutineSlot) => {
    setEditing(s);
    setForm({ day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room ?? '', type: s.type, note: s.note ?? '' });
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.endTime <= form.startTime) {
      toast.error('End time must be after start time');
      return;
    }
    setBusy(true);
    const body = { ...form, room: form.room.trim() || undefined, note: form.note.trim() || undefined };
    try {
      if (editing) await patch(`/classes/${id}/routine/${editing._id}`, body);
      else await post(`/classes/${id}/routine`, body);
      toast.success(editing ? 'Class time updated' : 'Class time added');
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await del(`/classes/${id}/routine/${deleting._id}`);
      toast.success('Class time removed');
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Weekly routine</h2>
          <p className="text-sm text-slate-500">{data?.length ? `${data.length} classes per week` : 'Class times for this course'}</p>
        </div>
        {isTeacher && (
          <Button onClick={openNew}>
            <Plus /> Add class time
          </Button>
        )}
      </div>

      {!data?.length ? (
        <Card>
          <EmptyState
            icon={<CalendarDays />}
            title="No class times yet"
            description={
              isTeacher
                ? 'Add the days and times this class meets. Students see it in their combined weekly routine.'
                : 'Your teacher has not added class times yet.'
            }
            action={
              isTeacher && (
                <Button onClick={openNew}>
                  <Plus /> Add class time
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <WeekView slots={data} onEdit={isTeacher ? openEdit : undefined} onDelete={isTeacher ? setDeleting : undefined} />
      )}

      {Boolean(data?.length) && <DaysOffPanel classId={id} slots={data ?? []} isTeacher={isTeacher} />}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit class time' : 'Add class time'}
        icon={<CalendarDays />}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="slot-form" loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <form id="slot-form" onSubmit={submit} className="space-y-4">
          <Field label="Day" required>
            <Select value={form.day} onChange={(e) => setForm({ ...form, day: Number(e.target.value) })}>
              {WEEK_ORDER.map((d) => (
                <option key={d} value={d}>
                  {DAYS[d]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts" required>
              <Input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </Field>
            <Field label="Ends" required>
              <Input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SlotType })}>
                {(Object.keys(SLOT_META) as SlotType[]).map((t) => (
                  <option key={t} value={t}>
                    {SLOT_META[t].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Room">
              <Input placeholder="e.g. 402" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </Field>
          </div>
          <Field label="Note">
            <Input
              placeholder="Optional, e.g. Group B only"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title="Remove this class time?"
        description={deleting ? `${DAYS[deleting.day]} ${deleting.startTime}–${deleting.endTime}` : undefined}
        confirmLabel="Remove"
      />
    </div>
  );
}
