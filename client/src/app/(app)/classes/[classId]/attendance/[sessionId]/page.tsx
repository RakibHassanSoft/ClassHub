'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, CloudOff, Printer, Save, Search, Smartphone, Trash2 } from 'lucide-react';
import { CheckinPanel } from '@/components/class/checkin-panel';
import { isNetworkError, pendingFor, queueSave } from '@/lib/offline-queue';
import { toast } from 'sonner';
import { useClassContext } from '@/components/class/class-context';
import { qk } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { del, errorMessage, get, patch } from '@/lib/api';
import { softTone, solidTone, tone } from '@/lib/colors';
import { cn, formatIsoDate, todayIso } from '@/lib/utils';
import type { AttendanceSessionDetail } from '@/lib/types';

export default function AttendanceSheetPage() {
  const { classroom, isTeacher } = useClassContext();
  const { sessionId } = useParams<{ sessionId: string }>();
  const classId = classroom._id;

  const { data, isLoading, error } = useQuery({
    queryKey: qk.session(classId, sessionId),
    queryFn: () => get<AttendanceSessionDetail>(`/classes/${classId}/attendance/${sessionId}`),
    enabled: isTeacher,
  });

  if (!isTeacher) return <EmptyState title="Only teachers can open attendance sheets" />;
  if (isLoading) return <PageLoader />;
  if (error || !data) return <EmptyState title="Attendance not found" description={errorMessage(error)} />;

  // remount the sheet whenever the saved version changes, so local edits start from the server copy
  return <AttendanceSheet key={`${data._id}-${data.updatedAt}`} data={data} />;
}

function AttendanceSheet({ data }: { data: AttendanceSessionDetail }) {
  const { classroom } = useClassContext();
  const router = useRouter();
  const qc = useQueryClient();
  const classId = classroom._id;
  const sessionId = data._id;

  // a sheet saved while offline wins over the older server copy until it syncs
  const [offlineCopy] = useState(() => pendingFor(classroom._id, data._id));
  const offlineBody = offlineCopy?.body as
    { date: string; label: string; topic: string; records: { entry: string; status: string }[] } | undefined;
  const [marks, setMarks] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(data.records.map((r) => [r.entry, r.status])),
    ...Object.fromEntries((offlineBody?.records ?? []).map((r) => [r.entry, r.status])),
  }));
  const [meta, setMeta] = useState(() =>
    offlineBody
      ? { date: offlineBody.date, label: offlineBody.label, topic: offlineBody.topic }
      : { date: data.date, label: data.label ?? '', topic: data.topic ?? '' },
  );
  const [selfChecked, setSelfChecked] = useState<Set<string>>(() => new Set(data.records.filter((r) => r.checkedInAt).map((r) => r.entry)));
  const [savedOffline, setSavedOffline] = useState(Boolean(offlineCopy));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const statuses = data.statuses;
  const records = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.records.filter((r) => !term || r.name.toLowerCase().includes(term) || r.studentId.toLowerCase().includes(term));
  }, [data, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    Object.values(marks).forEach((s) => {
      c[s || '_'] = (c[s || '_'] ?? 0) + 1;
    });
    return c;
  }, [marks]);

  const setOne = (entry: string, status: string) => {
    setMarks((m) => ({ ...m, [entry]: m[entry] === status ? '' : status }));
    setDirty(true);
  };
  const setAll = (status: string) => {
    setMarks((m) => Object.fromEntries(Object.keys(m).map((k) => [k, status])));
    setDirty(true);
  };

  const presentKey = useMemo(
    () => data.statuses.find((s) => s.key === 'P' && s.countsAsPresent)?.key ?? data.statuses.find((s) => s.countsAsPresent)?.key ?? 'P',
    [data.statuses],
  );
  const onCheckedIn = useCallback(
    (entry: string) => {
      setMarks((m) => ({ ...m, [entry]: presentKey }));
      setSelfChecked((s) => new Set(s).add(entry));
    },
    [presentKey],
  );

  const save = async () => {
    setSaving(true);
    const body = {
      date: meta.date,
      label: meta.label.trim(),
      topic: meta.topic.trim(),
      records: Object.entries(marks).map(([entry, status]) => ({ entry, status })),
    };
    try {
      await patch(`/classes/${classId}/attendance/${sessionId}`, body);
      setDirty(false);
      setSavedOffline(false);
      toast.success('Attendance saved');
      qc.invalidateQueries({ queryKey: qk.attendance(classId) });
      qc.invalidateQueries({ queryKey: qk.session(classId, sessionId) });
    } catch (err) {
      if (isNetworkError(err)) {
        queueSave({ classId, sessionId, label: `${classroom.courseCode || classroom.title} · ${formatIsoDate(meta.date)}`, body });
        setDirty(false);
        setSavedOffline(true);
        toast.warning('No internet. Saved on this device — it will sync automatically when you are back online.');
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await del(`/classes/${classId}/attendance/${sessionId}`);
      toast.success('Attendance deleted');
      qc.invalidateQueries({ queryKey: qk.attendance(classId) });
      router.replace(`/classes/${classId}/attendance`);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  };

  const unmarked = counts._ ?? 0;

  return (
    <div className="space-y-5 pb-24">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/classes/${classId}/attendance`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-4" /> Register
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
          <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Delete
          </Button>
        </div>
      </div>

      <Card className="no-print p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[180px_160px_1fr]">
          <div>
            <label className="text-xs font-semibold text-slate-500">Date</label>
            <Input
              type="date"
              value={meta.date}
              max="2100-12-31"
              onChange={(e) => (setMeta({ ...meta, date: e.target.value }), setDirty(true))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Label</label>
            <Input
              placeholder="Optional"
              value={meta.label}
              onChange={(e) => (setMeta({ ...meta, label: e.target.value }), setDirty(true))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Topic covered</label>
            <Input
              placeholder="Optional"
              value={meta.topic}
              onChange={(e) => (setMeta({ ...meta, topic: e.target.value }), setDirty(true))}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {statuses.map((s) => (
            <span
              key={s.key}
              className={cn('rounded-full px-3 py-1 text-xs font-bold tabular-nums ring-1 ring-inset', tone(softTone, s.color))}
            >
              {s.label}: {counts[s.key] ?? 0}
            </span>
          ))}
          {unmarked > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Not marked: {unmarked}</span>
          )}
        </div>
      </Card>

      {savedOffline && (
        <div className="no-print flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <CloudOff className="size-4 shrink-0" /> These marks are saved on this device and will be sent to the server when you are online.
        </div>
      )}
      <div className="no-print">
        <CheckinPanel
          classId={classId}
          sessionId={sessionId}
          className={classroom.courseCode || classroom.title}
          onCheckedIn={onCheckedIn}
        />
      </div>

      <Card className="print-area overflow-hidden">
        <div className="print-only pb-3">
          <h2 className="text-lg font-bold">
            {classroom.title} {classroom.courseCode && `(${classroom.courseCode})`} — Attendance {formatIsoDate(meta.date)}{' '}
            {meta.label && `(${meta.label})`}
          </h2>
          <p className="text-xs">
            {meta.topic && `Topic: ${meta.topic} · `}
            {statuses.map((s) => `${s.label}: ${counts[s.key] ?? 0}`).join(' · ')} · Printed {formatIsoDate(todayIso())}
          </p>
        </div>

        <div className="no-print flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <CheckCheck className="size-4" /> Mark all:
            </span>
            {statuses.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setAll(s.key)}
                className={cn(
                  'cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 transition ring-inset hover:brightness-95',
                  tone(softTone, s.color),
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="sm:w-64">
            <Input placeholder="Find a student" icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="h-9" />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="print-only">
            <tr>
              <th className="text-left">#</th>
              <th className="text-left">Student ID</th>
              <th className="text-left">Name</th>
              <th className="text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r, i) => {
              const current = marks[r.entry] ?? '';
              const st = statuses.find((s) => s.key === current);
              return (
                <tr key={r.entry} className={cn('transition', r.removed && 'opacity-60')}>
                  <td className="w-10 py-3 pl-4 text-xs text-slate-400 sm:pl-6">{i + 1}</td>
                  <td className="py-3 pr-2 font-mono text-xs text-slate-500 sm:w-36 print:table-cell">
                    <span className="hidden sm:inline print:inline">{r.studentId}</span>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-slate-800">{r.name}</p>
                    <p className="font-mono text-xs text-slate-500 sm:hidden print:hidden">{r.studentId}</p>
                    {r.removed && <p className="text-[11px] text-amber-600">Removed from class list</p>}
                    {selfChecked.has(r.entry) && (
                      <p className="no-print mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <Smartphone className="size-3" /> Checked in
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 sm:pr-6">
                    <span className="print-only">{st?.label ?? '—'}</span>
                    <div className="no-print flex justify-end gap-1.5">
                      {statuses.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          title={s.label}
                          onClick={() => setOne(r.entry, s.key)}
                          className={cn(
                            'grid size-9 cursor-pointer place-items-center rounded-xl text-xs font-bold ring-1 transition ring-inset active:scale-95 sm:size-10 sm:text-sm',
                            current === s.key
                              ? cn(tone(solidTone, s.color), 'shadow-md')
                              : 'bg-white text-slate-400 ring-slate-200 hover:bg-slate-50 hover:text-slate-700',
                          )}
                        >
                          {s.key}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {dirty && (
        <div className="no-print fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 px-4 lg:bottom-6 lg:left-72">
          <div className="animate-slide-up border-brand-200 shadow-lift mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 pl-5 backdrop-blur">
            <p className="text-brand-700 text-sm font-medium">You have unsaved changes</p>
            <Button onClick={save} loading={saving}>
              <Save /> Save attendance
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        loading={saving}
        title="Delete this attendance?"
        description={`All marks for ${formatIsoDate(data.date)} will be removed. This cannot be undone.`}
      />
    </div>
  );
}
