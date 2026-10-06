'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BookPlus, Check, KeyRound, ScanLine } from 'lucide-react';
import { QrScanner, extractJoinCode } from './qr-scanner';
import { ClassTimesEditor, emptyTimeGroup, scheduleError, toSchedule, type TimeGroup } from './class-times-editor';
import { useAuth } from '@/lib/auth-store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { errorMessage, post } from '@/lib/api';
import { CLASS_COLORS, swatch } from '@/lib/colors';
import { qk, useClasses } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import type { Classroom } from '@/lib/types';

export const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
  <div className="flex flex-wrap gap-2.5">
    {CLASS_COLORS.map((c) => (
      <button
        key={c}
        type="button"
        onClick={() => onChange(c)}
        className={cn(
          'grid size-9 cursor-pointer place-items-center rounded-full ring-offset-2 transition',
          swatch[c],
          value === c ? 'ring-2 ring-slate-900' : 'hover:scale-110',
        )}
        aria-label={c}
      >
        {value === c && <Check className="size-4 text-white" />}
      </button>
    ))}
  </div>
);

const TEMPLATE_PARTS = [
  ['settings', 'Settings', 'Attendance statuses, minimum %, chat rules'],
  ['routine', 'Routine', 'Weekly class times'],
  ['resources', 'Resources', 'Drive links and notes'],
  ['assessments', 'Assessments', 'Quiz/exam list and weights (no marks)'],
  ['roster', 'Class list', 'Same students (they join again with the new link)'],
] as const;
type TemplatePart = (typeof TEMPLATE_PARTS)[number][0];

export const CreateClassDialog = ({ open, onClose, sourceId: presetSource }: { open: boolean; onClose: () => void; sourceId?: string }) => {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: classes } = useClasses();
  const templates = (classes ?? []).filter((c) => c.myRole === 'teacher');
  const [sourceId, setSourceId] = useState(presetSource ?? '');
  const source = templates.find((c) => c._id === sourceId);
  const [include, setInclude] = useState<Record<TemplatePart, boolean>>({
    settings: true,
    routine: true,
    resources: true,
    assessments: true,
    roster: false,
  });
  const [form, setForm] = useState(() => {
    const src = (classes ?? []).find((c) => c._id === presetSource);
    return {
      title: src?.title ?? '',
      courseCode: src?.courseCode ?? '',
      section: src?.section ?? '',
      semester: '',
      room: src?.room ?? '',
      description: src?.description ?? '',
      color: src?.color ?? 'emerald',
    };
  });
  const [loading, setLoading] = useState(false);
  const [times, setTimes] = useState<TimeGroup[]>(() => [emptyTimeGroup()]);

  const pickSource = (id: string) => {
    setSourceId(id);
    const src = templates.find((c) => c._id === id);
    if (src) {
      setForm({
        title: src.title,
        courseCode: src.courseCode ?? '',
        section: src.section ?? '',
        semester: '',
        room: src.room ?? '',
        description: src.description ?? '',
        color: src.color,
      });
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!source && scheduleError(times)) {
      toast.error(scheduleError(times));
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      const schedule = toSchedule(times);
      if (!source && schedule.length) body.schedule = schedule;
      let newId: string;
      if (source) {
        const res = await post<{ classroom: Classroom }>(`/classes/${source._id}/clone`, { ...body, include });
        newId = res.data.classroom._id;
        toast.success(`Created from ${source.courseCode || source.title}. Share the new class code with students.`);
      } else {
        const res = await post<Classroom>('/classes', body);
        newId = res.data._id;
        toast.success('Class created. Next: add your students.');
      }
      qc.invalidateQueries({ queryKey: qk.classes });
      onClose();
      setForm({ title: '', courseCode: '', section: '', semester: '', room: '', description: '', color: 'emerald' });
      setSourceId('');
      setTimes([emptyTimeGroup()]);
      router.push(source && include.roster ? `/classes/${newId}` : `/classes/${newId}/students`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create a class"
      description="You can change all of this later in class settings."
      icon={<BookPlus />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-class" loading={loading}>
            {source ? 'Create from template' : 'Create class'}
          </Button>
        </>
      }
    >
      <form id="create-class" onSubmit={submit} className="space-y-4">
        {templates.length > 0 && (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <Field label="Start from" hint="Reuse a past class as a template for the new semester.">
              <Select value={sourceId} onChange={(e) => pickSource(e.target.value)}>
                <option value="">Blank class</option>
                {templates.map((c) => (
                  <option key={c._id} value={c._id}>
                    {[c.courseCode, c.title, c.semester].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </Select>
            </Field>
            {source && (
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATE_PARTS.map(([k, label, hint]) => (
                  <label key={k} className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-emerald-600"
                      checked={include[k]}
                      onChange={(e) => setInclude({ ...include, [k]: e.target.checked })}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{label}</span>
                      <span className="block text-xs text-slate-500">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <Field label="Class name" required>
          <Input required placeholder="e.g. Data Structures" value={form.title} onChange={set('title')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Course code">
            <Input placeholder="CSE-221" value={form.courseCode} onChange={set('courseCode')} />
          </Field>
          <Field label="Section">
            <Input placeholder="A" value={form.section} onChange={set('section')} />
          </Field>
          <Field label="Semester">
            <Input placeholder="Fall 2026" value={form.semester} onChange={set('semester')} />
          </Field>
        </div>
        <Field label="Room">
          <Input placeholder="e.g. Room 402, Building 2" value={form.room} onChange={set('room')} />
        </Field>
        {!source && <ClassTimesEditor value={times} onChange={setTimes} />}
        <Field label="Description">
          <Textarea
            placeholder="What students should know about this class (optional)"
            value={form.description}
            onChange={set('description')}
          />
        </Field>
        <Field label="Cover colour">
          <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
        </Field>
      </form>
    </Dialog>
  );
};

/** Google-Classroom style: type the class code or scan the teacher's QR. */
export const JoinClassDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const router = useRouter();
  const user = useAuth((st) => st.user);
  const [mode, setMode] = useState<'code' | 'scan'>('code');
  const [value, setValue] = useState('');

  const go = (code: string | null) => {
    if (!code) {
      toast.error('That is not a ClassHub class code');
      return;
    }
    onClose();
    setValue('');
    setMode('code');
    router.push(`/join/${code}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(extractJoinCode(value));
  };

  const onScan = useCallback((text: string) => go(extractJoinCode(text)), [router]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog
      open={open}
      onClose={() => {
        setMode('code');
        onClose();
      }}
      title="Join a class"
      description="Ask your teacher for the class code, or scan the QR code they show."
      icon={<KeyRound />}
      size="sm"
      footer={
        mode === 'code' ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="join-class" disabled={value.replace(/[^a-z0-9]/gi, '').length < 5}>
              Continue
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ['code', 'Enter code', <KeyRound key="k" className="size-4" />],
            ['scan', 'Scan QR', <ScanLine key="s" className="size-4" />],
          ] as const
        ).map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={cn(
              'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition',
              mode === k ? 'shadow-soft bg-white text-slate-900' : 'text-slate-500',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      {mode === 'code' ? (
        <form id="join-class" onSubmit={submit} className="space-y-4">
          <Field label="Class code" hint="5–8 letters and numbers, e.g. AB3CD7E. A full invite link works too.">
            <Input
              required
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="AB3CD7E"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-14 text-center font-mono text-2xl font-bold tracking-[0.25em] uppercase placeholder:tracking-[0.25em]"
            />
          </Field>
          {user?.studentId && (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 ring-1 ring-slate-200">
              You will join as <b>{user.name}</b> with register ID <b className="font-mono">{user.studentId}</b>.
            </p>
          )}
        </form>
      ) : (
        <div className="space-y-3">
          {open && mode === 'scan' && <QrScanner onResult={onScan} />}
          <p className="text-center text-xs text-slate-500">Point the camera at the QR code on your teacher&apos;s screen.</p>
        </div>
      )}
    </Dialog>
  );
};
