'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Award, Download, Eye, EyeOff, GraduationCap, Pencil, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClassContext } from '@/components/class/class-context';
import { qk, useMarksSheet, useMyMarks } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { EmptyState, PageLoader, StatTile } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Menu } from '@/components/ui/menu';
import { del, errorMessage, patch, post, put } from '@/lib/api';
import { downloadExcel } from '@/lib/export';
import { CATEGORY_LABEL } from '@/lib/meta';
import { cn, formatIsoDate, todayIso } from '@/lib/utils';
import type { AssessmentCategory, Classroom, MarksSheet } from '@/lib/types';

type Assessment = MarksSheet['assessments'][number];
const emptyForm = { name: '', category: 'quiz' as AssessmentCategory, maxMarks: '10', weight: '', date: '', published: false };

const AssessmentDialog = ({
  open,
  onClose,
  classId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  classId: string;
  editing: Assessment | null;
}) => {
  const qc = useQueryClient();
  const [form, setForm] = useState(() =>
    editing
      ? {
          name: editing.name,
          category: editing.category,
          maxMarks: String(editing.maxMarks),
          weight: editing.weight ? String(editing.weight) : '',
          date: editing.date ?? '',
          published: editing.published,
        }
      : emptyForm,
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const body = {
      name: form.name.trim(),
      category: form.category,
      maxMarks: Number(form.maxMarks),
      weight: form.weight === '' ? null : Number(form.weight),
      date: form.date,
      published: form.published,
    };
    try {
      if (editing) await patch(`/classes/${classId}/marks/${editing._id}`, body);
      else await post(`/classes/${classId}/marks`, body);
      toast.success(editing ? 'Assessment updated' : 'Assessment added — enter marks in the sheet');
      qc.invalidateQueries({ queryKey: qk.marks(classId) });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit assessment' : 'New assessment'}
      description="Quiz, assignment, mid-term… anything you want to grade."
      icon={<Award />}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assessment-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="assessment-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" required>
          <Input required placeholder="e.g. Quiz 1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as AssessmentCategory })}>
              {(Object.keys(CATEGORY_LABEL) as AssessmentCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Total marks" required>
            <Input
              type="number"
              required
              min="0.5"
              step="0.5"
              value={form.maxMarks}
              onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
            />
          </Field>
          <Field label="Weight (%)" hint="Optional, for final grade">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              placeholder="e.g. 10"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="size-4 accent-emerald-600"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Publish to students now
        </label>
      </form>
    </Dialog>
  );
};

const TeacherMarks = ({ classroom }: { classroom: Classroom }) => {
  const { data, isLoading, dataUpdatedAt } = useMarksSheet(classroom._id);
  if (isLoading || !data) return <PageLoader />;
  return <GradeSheet key={dataUpdatedAt} classroom={classroom} data={data} />;
};

const initialDraft = (data: MarksSheet) => {
  const next: Record<string, Record<string, string>> = {};
  data.assessments.forEach((a) => {
    next[a._id] = Object.fromEntries(data.students.map((s) => [s._id, String(a.scores[s._id]?.score ?? '')]));
  });
  return next;
};

const GradeSheet = ({ classroom, data }: { classroom: Classroom; data: MarksSheet }) => {
  const id = classroom._id;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>(() => initialDraft(data));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; editing: Assessment | null }>({ open: false, editing: null });
  const [deleting, setDeleting] = useState<Assessment | null>(null);

  const liveTotals = useMemo(() => {
    const out: Record<string, { obtained: number; max: number; weighted: number; hasWeight: boolean }> = {};
    data.students.forEach((s) => {
      let obtained = 0;
      let max = 0;
      let weighted = 0;
      let hasWeight = false;
      data.assessments.forEach((a) => {
        const raw = draft[a._id]?.[s._id];
        if (raw === undefined || raw === '') return;
        const v = Number(raw);
        if (Number.isNaN(v)) return;
        obtained += v;
        max += a.maxMarks;
        if (a.weight) {
          hasWeight = true;
          weighted += (v / a.maxMarks) * a.weight;
        }
      });
      out[s._id] = { obtained: Math.round(obtained * 100) / 100, max, weighted: Math.round(weighted * 100) / 100, hasWeight };
    });
    return out;
  }, [data, draft]);

  const setCell = (aid: string, sid: string, value: string) => {
    setDraft((d) => ({ ...d, [aid]: { ...d[aid], [sid]: value } }));
    setDirty((s) => new Set(s).add(aid));
  };

  const invalid = (a: Assessment, v?: string) =>
    v !== undefined && v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > a.maxMarks);
  const hasInvalid = data.assessments.some((a) => data.students.some((s) => invalid(a, draft[a._id]?.[s._id])));

  const save = async () => {
    if (hasInvalid) {
      toast.error('Some marks are above the total or not numbers (highlighted in red)');
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        [...dirty].map((aid) =>
          put(`/classes/${id}/marks/${aid}/scores`, {
            scores: data.students.map((s) => {
              const raw = draft[aid]?.[s._id];
              return { entry: s._id, score: raw === undefined || raw === '' ? null : Number(raw) };
            }),
          }),
        ),
      );
      toast.success('Marks saved');
      qc.invalidateQueries({ queryKey: qk.marks(id) });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (a: Assessment) => {
    try {
      await patch(`/classes/${id}/marks/${a._id}`, { published: !a.published });
      toast.success(a.published ? 'Hidden from students' : 'Published — students can now see their marks');
      qc.invalidateQueries({ queryKey: qk.marks(id) });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await del(`/classes/${id}/marks/${deleting._id}`);
      toast.success('Assessment deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: qk.marks(id) });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const anyWeight = data.assessments.some((a) => a.weight);
  const totalWeight = data.assessments.reduce((t, a) => t + (a.weight ?? 0), 0);

  const exportExcel = () => {
    const header = [
      '#',
      'Student ID',
      'Name',
      ...data.assessments.map((a) => `${a.name} (${a.maxMarks})`),
      'Total',
      'Out of',
      ...(anyWeight ? [`Weighted (/${totalWeight})`] : []),
    ];
    const rows = data.students.map((s, i) => {
      const t = liveTotals[s._id];
      return [
        i + 1,
        s.studentId,
        s.name,
        ...data.assessments.map((a) => (draft[a._id]?.[s._id] === '' ? '' : Number(draft[a._id]?.[s._id]))),
        t.obtained,
        t.max,
        ...(anyWeight ? [t.weighted] : []),
      ];
    });
    downloadExcel(`${classroom.courseCode || classroom.title} - marks`, [{ name: 'Marks', rows: [header, ...rows] }]);
  };

  const published = data.assessments.filter((a) => a.published).length;

  return (
    <div className="space-y-6 pb-20">
      <div className="no-print grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile label="Assessments" value={data.assessments.length} icon={<Award />} />
        <StatTile label="Published" value={`${published}/${data.assessments.length}`} icon={<Eye />} accent="teal" />
        <StatTile
          label="Total weight"
          value={anyWeight ? `${totalWeight}%` : '—'}
          icon={<GraduationCap />}
          accent="violet"
          hint={anyWeight && totalWeight !== 100 ? 'Weights do not add up to 100%' : undefined}
        />
      </div>

      <Card className="print-area overflow-hidden">
        <div className="print-only pb-3">
          <h2 className="text-lg font-bold">
            {classroom.title} {classroom.courseCode && `(${classroom.courseCode})`} — Marks
          </h2>
          <p className="text-xs">Printed {formatIsoDate(todayIso())}</p>
        </div>
        <div className="no-print">
          <CardHeader
            title="Grade sheet"
            description="Type marks directly into the sheet. Students only see published assessments."
            action={
              <>
                <Button variant="outline" size="sm" onClick={exportExcel} disabled={!data.assessments.length}>
                  <Download /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!data.assessments.length}>
                  <Printer /> Print
                </Button>
                <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
                  <Plus /> Assessment
                </Button>
              </>
            }
          />
          <div className="h-5" />
        </div>

        {!data.students.length ? (
          <EmptyState icon={<GraduationCap />} title="Add students first" description="Your class list is empty." />
        ) : !data.assessments.length ? (
          <EmptyState
            icon={<Award />}
            title="No assessments yet"
            description="Create a quiz, assignment or exam, then type marks for each student."
            action={
              <Button onClick={() => setDialog({ open: true, editing: null })}>
                <Plus /> New assessment
              </Button>
            }
          />
        ) : (
          <div className="scrollbar-thin overflow-x-auto border-t border-slate-100">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-56 border-b border-slate-100 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Student
                  </th>
                  {data.assessments.map((a) => (
                    <th key={a._id} className="min-w-32 border-b border-slate-100 bg-slate-50 px-2 py-2 align-top">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 text-left">
                          <p className="truncate text-[13px] font-bold text-slate-800">{a.name}</p>
                          <p className="text-[11px] font-medium text-slate-500">
                            /{a.maxMarks}
                            {a.weight ? ` · ${a.weight}%` : ''}
                          </p>
                          <button
                            type="button"
                            onClick={() => togglePublish(a)}
                            className={cn(
                              'no-print mt-1 inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                              a.published
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
                            )}
                          >
                            {a.published ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                            {a.published ? 'Published' : 'Hidden'}
                          </button>
                        </div>
                        <div className="no-print">
                          <Menu
                            items={[
                              { label: 'Edit', icon: <Pencil />, onClick: () => setDialog({ open: true, editing: a }) },
                              {
                                label: a.published ? 'Hide from students' : 'Publish',
                                icon: a.published ? <EyeOff /> : <Eye />,
                                onClick: () => togglePublish(a),
                              },
                              { label: 'Delete', icon: <Trash2 />, onClick: () => setDeleting(a), danger: true },
                            ]}
                          />
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 min-w-28 border-b border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => {
                  const t = liveTotals[s._id];
                  return (
                    <tr key={s._id} className="group">
                      <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-2 group-hover:bg-slate-50">
                        <p className="truncate font-semibold text-slate-800">{s.name}</p>
                        <p className="font-mono text-xs text-slate-500">{s.studentId}</p>
                      </td>
                      {data.assessments.map((a) => {
                        const v = draft[a._id]?.[s._id] ?? '';
                        return (
                          <td key={a._id} className="border-b border-slate-100 px-2 py-1.5 group-hover:bg-slate-50">
                            <input
                              inputMode="decimal"
                              value={v}
                              onChange={(e) => setCell(a._id, s._id, e.target.value.replace(',', '.'))}
                              placeholder="–"
                              aria-label={`${s.name} ${a.name}`}
                              className={cn(
                                'h-9 w-full rounded-lg border bg-white px-2 text-center text-sm font-semibold tabular-nums transition focus:ring-2 focus:outline-none',
                                invalid(a, v)
                                  ? 'border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-500/20'
                                  : 'focus:border-brand-500 focus:ring-brand-500/15 border-slate-200 text-slate-800',
                              )}
                            />
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 border-b border-slate-100 bg-white px-4 py-2 text-center group-hover:bg-slate-50">
                        <p className="font-bold text-slate-900 tabular-nums">
                          {t.obtained}
                          <span className="text-xs font-medium text-slate-400">/{t.max}</span>
                        </p>
                        {t.hasWeight && <p className="text-brand-600 text-[11px] font-semibold tabular-nums">{t.weighted} wtd</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-xs text-slate-500">
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 font-semibold">Class average</td>
                  {data.assessments.map((a) => (
                    <td key={a._id} className="bg-slate-50 px-2 py-2.5 text-center font-semibold tabular-nums">
                      {a.stats.average ?? '—'}
                    </td>
                  ))}
                  <td className="sticky right-0 bg-slate-50" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {dirty.size > 0 && (
        <div className="no-print fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 px-4 lg:bottom-6 lg:left-72">
          <div className="animate-slide-up border-brand-200 shadow-lift mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl border bg-white/95 p-3 pl-5 backdrop-blur">
            <p className="text-brand-700 text-sm font-medium">
              Unsaved marks in {dirty.size} assessment{dirty.size > 1 ? 's' : ''}
            </p>
            <Button onClick={save} loading={saving}>
              <Save /> Save marks
            </Button>
          </div>
        </div>
      )}

      {dialog.open && (
        <AssessmentDialog open editing={dialog.editing} classId={id} onClose={() => setDialog({ open: false, editing: null })} />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={saving}
        title={`Delete ${deleting?.name}?`}
        description="All marks entered for this assessment will be deleted."
      />
    </div>
  );
};

const StudentMarks = ({ classroom }: { classroom: Classroom }) => {
  const { data, isLoading, error } = useMyMarks(classroom._id);
  if (isLoading) return <PageLoader />;
  if (error || !data)
    return (
      <Card>
        <EmptyState icon={<GraduationCap />} title="Marks not available" description={errorMessage(error)} />
      </Card>
    );

  const { totals } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile label="Total marks" value={totals.max ? `${totals.obtained}/${totals.max}` : '—'} icon={<Award />} />
        <StatTile label="Percentage" value={totals.percent === null ? '—' : `${totals.percent}%`} icon={<GraduationCap />} accent="teal" />
        {totals.weighted !== null && (
          <StatTile label="Weighted score" value={`${totals.weighted}/${totals.weightTotal}`} icon={<Award />} accent="violet" />
        )}
      </div>
      <Card>
        <CardHeader title="My marks" description="Only assessments your teacher has published are shown." icon={<GraduationCap />} />
        {data.assessments.length === 0 ? (
          <EmptyState
            icon={<GraduationCap />}
            title="No marks published yet"
            description="You will see your marks here when your teacher publishes them."
          />
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {data.assessments.map((a) => {
              const pct = a.score === null ? null : Math.round((a.score / a.maxMarks) * 100);
              return (
                <li key={a._id} className="px-5 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{a.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge color="slate">{CATEGORY_LABEL[a.category]}</Badge>
                        {a.date && formatIsoDate(a.date)}
                        {a.weight ? ` · ${a.weight}% of final` : ''}
                      </div>
                    </div>
                    <p className="font-display shrink-0 text-xl font-bold text-slate-900 tabular-nums">
                      {a.score ?? '—'}
                      <span className="text-sm font-medium text-slate-400">/{a.maxMarks}</span>
                    </p>
                  </div>
                  {pct !== null && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-teal-500' : 'bg-amber-500',
                        )}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  )}
                  {a.remarks && <p className="mt-2 text-sm text-slate-600">“{a.remarks}”</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default function MarksPage() {
  const { classroom, isTeacher } = useClassContext();
  return isTeacher ? <TeacherMarks classroom={classroom} /> : <StudentMarks classroom={classroom} />;
}
