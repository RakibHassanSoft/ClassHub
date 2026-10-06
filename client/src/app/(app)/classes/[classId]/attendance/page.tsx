'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BarChart3, CalendarPlus, ClipboardCheck, Download, Percent, Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useClassContext } from '@/components/class/class-context';
import { PercentPill, StatusChip } from '@/components/class/status-chip';
import { AttendanceInsights } from '@/components/class/attendance-insights';
import { qk, useAttendanceRegister, useMyAttendance } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { EmptyState, PageLoader, StatTile } from '@/components/ui/misc';
import { errorMessage, post } from '@/lib/api';
import { downloadExcel } from '@/lib/export';
import { softTone, tone } from '@/lib/colors';
import { cn, formatIsoDate, todayIso, weekdayOfIso } from '@/lib/utils';
import type { Classroom } from '@/lib/types';

const NewSessionDialog = ({ open, onClose, classroom }: { open: boolean; onClose: () => void; classroom: Classroom }) => {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({ date: todayIso(), label: '', topic: '', defaultStatus: 'P' });
  const [loading, setLoading] = useState(false);
  const statuses = classroom.settings.attendanceStatuses;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await post<{ _id: string }>(`/classes/${classroom._id}/attendance`, {
        date: form.date,
        label: form.label.trim(),
        topic: form.topic.trim() || undefined,
        defaultStatus: form.defaultStatus,
      });
      qc.invalidateQueries({ queryKey: qk.attendance(classroom._id) });
      onClose();
      router.push(`/classes/${classroom._id}/attendance/${res.data._id}`);
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
      title="Take attendance"
      description="Your class list loads automatically for this date."
      icon={<CalendarPlus />}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-session" loading={loading}>
            Open sheet
          </Button>
        </>
      }
    >
      <form id="new-session" onSubmit={submit} className="space-y-4">
        <Field label="Date" required>
          <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Start everyone as">
          <Select value={form.defaultStatus} onChange={(e) => setForm({ ...form, defaultStatus: e.target.value })}>
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
            <option value="">Not marked</option>
          </Select>
        </Field>
        <Field label="Label" hint='Only needed for a second class on the same day, e.g. "Lab".'>
          <Input placeholder="Optional" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <Field label="Topic covered">
          <Input
            placeholder="Optional, e.g. Binary search trees"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
          />
        </Field>
      </form>
    </Dialog>
  );
};

const TeacherAttendance = ({ classroom }: { classroom: Classroom }) => {
  const { data, isLoading } = useAttendanceRegister(classroom._id);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const students = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.students ?? []).filter((s) => !term || s.name.toLowerCase().includes(term) || s.studentId.toLowerCase().includes(term));
  }, [data, q]);

  if (isLoading || !data) return <PageLoader />;

  const { sessions, statuses, summary, threshold } = data;
  const percents = Object.values(summary)
    .map((s) => s.percent)
    .filter((p): p is number => p !== null);
  const avg = percents.length ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10 : null;
  const below = percents.filter((p) => p < threshold).length;

  const exportExcel = () => {
    const header = [
      '#',
      'Student ID',
      'Name',
      ...sessions.map((s) => `${s.date}${s.label ? ` (${s.label})` : ''}`),
      'Present',
      'Total',
      '%',
    ];
    const rows = data.students.map((st, i) => {
      const sum = summary[st._id];
      return [
        i + 1,
        st.studentId,
        st.name,
        ...sessions.map((s) => s.marks[st._id] ?? ''),
        sum?.present ?? 0,
        sum?.total ?? 0,
        sum?.percent ?? '',
      ];
    });
    const legend = statuses.map((s) => [s.key, s.label, s.countsAsPresent ? 'Counts as present' : 'Counts as absent']);
    downloadExcel(`${classroom.courseCode || classroom.title} - attendance`, [
      { name: 'Attendance', rows: [header, ...rows] },
      { name: 'Legend', rows: [['Code', 'Status', 'Counting'], ...legend] },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="no-print grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile label="Classes taken" value={sessions.length} icon={<ClipboardCheck />} />
        <StatTile label="Average attendance" value={avg === null ? '—' : `${avg}%`} icon={<Percent />} accent="teal" />
        <StatTile
          label={`Below ${threshold}%`}
          value={below}
          icon={<AlertTriangle />}
          accent={below ? 'rose' : 'sky'}
          hint={below ? 'Students at risk' : 'Everyone is on track'}
        />
      </div>

      <Card className="print-area overflow-hidden">
        <div className="print-only px-1 pb-3">
          <h2 className="text-lg font-bold">
            {classroom.title} {classroom.courseCode && `(${classroom.courseCode})`} — Attendance register
          </h2>
          <p className="text-xs">
            {[classroom.section && `Section ${classroom.section}`, classroom.semester, classroom.owner?.name].filter(Boolean).join(' · ')} ·
            Printed {formatIsoDate(todayIso())}
          </p>
        </div>
        <div className="no-print">
          <CardHeader
            title="Attendance register"
            description={`${data.students.length} students · ${sessions.length} classes`}
            action={
              <>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={!sessions.length}>
                  <Download /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!sessions.length}>
                  <Printer /> Print
                </Button>
                <Button size="sm" onClick={() => setOpen(true)}>
                  <CalendarPlus /> Take attendance
                </Button>
              </>
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-4 sm:px-6">
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <span
                  key={s.key}
                  className={cn('rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', tone(softTone, s.color))}
                >
                  {s.key} = {s.label}
                </span>
              ))}
            </div>
            {data.students.length > 0 && (
              <div className="w-full sm:w-60">
                <Input placeholder="Find a student" icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
              </div>
            )}
          </div>
        </div>

        {!data.students.length ? (
          <EmptyState icon={<ClipboardCheck />} title="Add students first" description="Go to the Students tab and add your class list." />
        ) : !sessions.length ? (
          <EmptyState
            icon={<CalendarPlus />}
            title="No attendance yet"
            description="Pick a date and mark your students. You can edit any day later."
            action={
              <Button onClick={() => setOpen(true)}>
                <CalendarPlus /> Take first attendance
              </Button>
            }
          />
        ) : (
          <div className="scrollbar-thin overflow-x-auto border-t border-slate-100">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="sticky left-0 z-10 min-w-56 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-left font-semibold uppercase">
                    Student
                  </th>
                  {sessions.map((s) => (
                    <th key={s._id} className="border-b border-slate-100 bg-slate-50 px-1.5 py-2 font-semibold">
                      <Link
                        href={`/classes/${classroom._id}/attendance/${s._id}`}
                        className="hover:bg-brand-50 hover:text-brand-700 flex flex-col items-center rounded-lg px-1.5 py-1 transition"
                        title={s.topic || 'Open sheet'}
                      >
                        <span className="text-[10px] uppercase">{weekdayOfIso(s.date)}</span>
                        <span className="whitespace-nowrap text-slate-800">{formatIsoDate(s.date, true)}</span>
                        {s.label && <span className="text-brand-600 text-[10px]">{s.label}</span>}
                      </Link>
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-center font-semibold uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((st) => {
                  const sum = summary[st._id];
                  return (
                    <tr key={st._id} className="group">
                      <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2 group-hover:bg-slate-50">
                        <p className="truncate font-semibold text-slate-800">{st.name}</p>
                        <p className="font-mono text-xs text-slate-500">{st.studentId}</p>
                      </td>
                      {sessions.map((s) => (
                        <td key={s._id} className="border-b border-slate-100 px-1.5 py-2 text-center group-hover:bg-slate-50">
                          <StatusChip status={s.marks[st._id] ?? ''} statuses={statuses} size="sm" solid={false} />
                        </td>
                      ))}
                      <td className="sticky right-0 z-10 border-b border-slate-100 bg-white px-4 py-2 text-center group-hover:bg-slate-50">
                        <PercentPill value={sum?.percent ?? null} threshold={threshold} />
                        <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                          {sum?.present ?? 0}/{sum?.total ?? 0}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <NewSessionDialog open={open} onClose={() => setOpen(false)} classroom={classroom} />
    </div>
  );
};

const StudentAttendance = ({ classroom }: { classroom: Classroom }) => {
  const { data, isLoading, error } = useMyAttendance(classroom._id);
  if (isLoading) return <PageLoader />;
  if (error || !data)
    return (
      <Card>
        <EmptyState icon={<ClipboardCheck />} title="Attendance not available" description={errorMessage(error)} />
      </Card>
    );
  if (data.hidden) {
    return (
      <Card>
        <EmptyState
          icon={<ClipboardCheck />}
          title="Attendance is private"
          description="Your teacher has not made attendance visible for this class."
        />
      </Card>
    );
  }

  const pct = data.summary?.percent ?? null;
  const threshold = data.threshold ?? 75;
  const low = pct !== null && pct < threshold;
  const counts = data.statuses.map((s) => ({ ...s, n: data.sessions.filter((x) => x.status === s.key).length }));
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative size-40">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={low ? '#f43f5e' : '#10b981'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (C * (pct ?? 0)) / 100}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <p className="font-display text-3xl font-extrabold text-slate-900">{pct === null ? '—' : `${pct}%`}</p>
                <p className="text-xs text-slate-500">attendance</p>
              </div>
            </div>
          </div>
          <p className={cn('mt-4 text-sm font-semibold', low ? 'text-rose-600' : 'text-emerald-600')}>
            {pct === null ? 'No classes recorded yet' : low ? `Below the required ${threshold}%` : 'You are on track'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Present in {data.summary?.present ?? 0} of {data.summary?.total ?? 0} classes
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {counts.map((c) => (
            <div key={c.key} className={cn('rounded-xl px-3 py-2.5 ring-1 ring-inset', tone(softTone, c.color))}>
              <p className="text-lg font-bold tabular-nums">{c.n}</p>
              <p className="text-xs font-medium">{c.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Class history" description={`${data.sessions.length} classes`} icon={<ClipboardCheck />} />
        {data.sessions.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck />}
            title="No attendance yet"
            description="Your record will appear here after your teacher takes attendance."
          />
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {data.sessions.map((s) => {
              const st = data.statuses.find((x) => x.key === s.status);
              return (
                <li key={s._id} className="flex items-center gap-4 px-5 py-3 sm:px-6">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-50 text-center ring-1 ring-slate-200">
                    <div>
                      <p className="text-[10px] leading-none font-semibold text-slate-500 uppercase">{weekdayOfIso(s.date)}</p>
                      <p className="mt-0.5 text-sm leading-none font-bold text-slate-800">{Number(s.date.slice(8))}</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatIsoDate(s.date)} {s.label && <span className="text-brand-600">· {s.label}</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{s.topic || 'Class'}</p>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset', tone(softTone, st?.color))}>
                    {st?.label ?? (s.status || 'Not marked')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default function AttendancePage() {
  const { classroom, isTeacher } = useClassContext();
  const [view, setView] = useState<'register' | 'insights'>('register');
  if (!isTeacher) return <StudentAttendance classroom={classroom} />;
  return (
    <div className="space-y-5">
      <div className="no-print inline-flex rounded-xl bg-slate-100 p-1">
        {(
          [
            ['register', 'Register', <ClipboardCheck key="r" className="size-4" />],
            ['insights', 'Insights', <BarChart3 key="i" className="size-4" />],
          ] as const
        ).map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition',
              view === k ? 'shadow-soft bg-white text-slate-900' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      {view === 'register' ? <TeacherAttendance classroom={classroom} /> : <AttendanceInsights classId={classroom._id} />}
    </div>
  );
}
