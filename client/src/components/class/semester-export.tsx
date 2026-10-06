'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { errorMessage, get } from '@/lib/api';
import { downloadExcel } from '@/lib/export';
import { cn } from '@/lib/utils';
import type { Classroom, SemesterReportClass } from '@/lib/types';

const sheetName = (base: string, used: Set<string>) => {
  let name = base.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  let i = 2;
  while (used.has(name)) name = `${base.slice(0, 27)} (${i++})`;
  used.add(name);
  return name;
};

const buildWorkbook = (report: SemesterReportClass[], label: string) => {
  const used = new Set<string>();
  const summary: (string | number | null)[][] = [
    ['Course', 'Class', 'Section', 'Semester', 'Students', 'Classes taken', 'Average attendance %', 'Below minimum', 'Assessments'],
  ];
  const sheets: { name: string; rows: (string | number | null)[][] }[] = [];

  report.forEach((c) => {
    const code = c.courseCode || c.title;
    const percents = c.students.map((s) => s.attendance?.percent).filter((p): p is number => p !== null && p !== undefined);
    const avg = percents.length ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10 : null;
    summary.push([
      c.courseCode ?? '',
      c.title,
      c.section ?? '',
      c.semester ?? '',
      c.students.length,
      c.sessions.length,
      avg,
      percents.filter((p) => p < c.threshold).length,
      c.assessments.length,
    ]);

    const anyWeight = c.assessments.some((a) => a.weight);
    const weightSum = c.assessments.reduce((t, a) => t + (a.weight ?? 0), 0);
    sheets.push({
      name: sheetName(`${code} Result`, used),
      rows: [
        [
          '#',
          'Student ID',
          'Name',
          'Present',
          'Classes',
          'Attendance %',
          ...c.assessments.map((a) => `${a.name} (/${a.maxMarks})`),
          'Marks total',
          'Out of',
          'Marks %',
          ...(anyWeight ? [`Weighted (/${weightSum})`] : []),
        ],
        ...c.students.map((s, i) => [
          i + 1,
          s.studentId,
          s.name,
          s.attendance?.present ?? 0,
          s.attendance?.total ?? 0,
          s.attendance?.percent ?? null,
          ...c.assessments.map((a) => s.scores[a._id] ?? null),
          s.totals?.obtained ?? 0,
          s.totals?.max ?? 0,
          s.totals?.percent ?? null,
          ...(anyWeight ? [s.totals?.weighted ?? null] : []),
        ]),
      ],
    });
    if (c.sessions.length) {
      sheets.push({
        name: sheetName(`${code} Attendance`, used),
        rows: [
          ['#', 'Student ID', 'Name', ...c.sessions.map((s) => `${s.date}${s.label ? ` ${s.label}` : ''}`)],
          ...c.students.map((s, i) => [i + 1, s.studentId, s.name, ...c.sessions.map((x) => x.marks[s._id] ?? '')]),
        ],
      });
    }
  });

  downloadExcel(`ClassHub ${label}`.trim(), [{ name: 'Summary', rows: summary }, ...sheets]);
};

/** Teachers pick classes (grouped by semester) and download one workbook for all of them. */
export const SemesterExportButton = ({ classes }: { classes: Classroom[] }) => {
  const teaching = useMemo(() => classes.filter((c) => c.myRole === 'teacher'), [classes]);
  const semesters = useMemo(() => [...new Set(teaching.map((c) => c.semester || 'No semester'))], [teaching]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  if (!teaching.length) return null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleSemester = (sem: string) => {
    const ids = teaching.filter((c) => (c.semester || 'No semester') === sem).map((c) => c._id);
    const all = ids.every((id) => selected.has(id));
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (all ? n.delete(id) : n.add(id)));
      return n;
    });
  };

  const download = async () => {
    setBusy(true);
    try {
      const ids = [...selected];
      const report = await get<SemesterReportClass[]>('/reports/semester', { classIds: ids.join(',') });
      const sems = [...new Set(report.map((r) => r.semester).filter(Boolean))];
      buildWorkbook(report, sems.length === 1 ? (sems[0] as string) : 'semester report');
      toast.success(`Downloaded ${report.length} class${report.length > 1 ? 'es' : ''}`);
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setSelected(new Set(teaching.filter((c) => !c.archived).map((c) => c._id)));
          setOpen(true);
        }}
      >
        <FileSpreadsheet /> Export semester
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Export semester report"
        description="One Excel file: a summary sheet, plus attendance and marks for every class you pick."
        icon={<FileSpreadsheet />}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={download} loading={busy} disabled={!selected.size}>
              Download {selected.size ? `(${selected.size})` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {semesters.map((sem) => {
            const list = teaching.filter((c) => (c.semester || 'No semester') === sem);
            const all = list.every((c) => selected.has(c._id));
            return (
              <div key={sem}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">{sem}</p>
                  <button type="button" onClick={() => toggleSemester(sem)} className="text-brand-600 cursor-pointer text-xs font-semibold">
                    {all ? 'Clear' : 'Select all'}
                  </button>
                </div>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {list.map((c) => (
                    <label
                      key={c._id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50',
                        selected.has(c._id) && 'bg-brand-50/40',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-emerald-600"
                        checked={selected.has(c._id)}
                        onChange={() => toggle(c._id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {c.courseCode ? `${c.courseCode} · ${c.title}` : c.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.stats.students} students{c.section ? ` · Section ${c.section}` : ''}
                          {c.archived ? ' · Archived' : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Dialog>
    </>
  );
};
