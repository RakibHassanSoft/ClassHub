'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExtractedStudent } from '@/lib/types';

export type PreviewRow = ExtractedStudent & { key: string };

const cell =
  'w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-slate-800 hover:border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15 focus:outline-none';

/** Editable review table used for both CSV/Excel and AI imports. */
export const ImportPreviewDialog = ({
  open,
  onClose,
  rows: initialRows,
  source,
  existingIds,
  notes,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  rows: PreviewRow[];
  source: 'csv' | 'ai';
  existingIds: Set<string>;
  notes?: string;
  onSave: (rows: PreviewRow[], onDuplicate: 'update' | 'skip') => void;
  saving: boolean;
}) => {
  const [rows, setRows] = useState<PreviewRow[]>(initialRows);
  const [onDuplicate, setOnDuplicate] = useState<'update' | 'skip'>('skip');

  const issuesOf = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const id = r.studentId.trim().toUpperCase();
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return (r: PreviewRow) => {
      const out: string[] = [];
      const id = r.studentId.trim().toUpperCase();
      if (!id) out.push('Missing ID');
      if (!r.name.trim()) out.push('Missing name');
      if (id && (counts.get(id) ?? 0) > 1) out.push('Duplicate in list');
      if (id && existingIds.has(id)) out.push('Already in class');
      return out;
    };
  }, [rows, existingIds]);

  const update = (key: string, patch: Partial<PreviewRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = () => setRows((rs) => [...rs, { key: crypto.randomUUID(), studentId: '', name: '', confidence: 'high', issues: [] }]);

  const blocking = rows.filter((r) => issuesOf(r).some((i) => i.startsWith('Missing') || i === 'Duplicate in list')).length;
  const lowConfidence = rows.filter((r) => r.confidence === 'low').length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      icon={source === 'ai' ? <Sparkles /> : <Upload />}
      title={source === 'ai' ? 'Review AI results' : 'Review imported students'}
      description={`${rows.length} students found. Fix anything that looks wrong before saving.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(rows, onDuplicate)} loading={saving} disabled={!rows.length || blocking > 0}>
            Save {rows.length} students
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {source === 'ai' && (
          <div className="flex gap-3 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-800 ring-1 ring-amber-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              AI can misread characters. Check the IDs carefully — a wrong ID stops that student from joining.
              {lowConfidence > 0 && <b> {lowConfidence} rows are marked low confidence.</b>}
              {notes && <p className="mt-1 text-amber-700">{notes}</p>}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="w-10 px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Student ID</th>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="w-24 px-3 py-2.5">Section</th>
                <th className="px-3 py-2.5">Check</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const issues = issuesOf(r);
                return (
                  <tr
                    key={r.key}
                    className={cn(issues.some((x) => x.startsWith('Missing') || x.startsWith('Duplicate')) && 'bg-rose-50/50')}
                  >
                    <td className="px-3 py-1 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-1 py-1">
                      <input
                        className={cn(cell, 'font-mono')}
                        value={r.studentId}
                        onChange={(e) => update(r.key, { studentId: e.target.value })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input className={cell} value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} />
                    </td>
                    <td className="px-1 py-1">
                      <input className={cell} value={r.email ?? ''} onChange={(e) => update(r.key, { email: e.target.value })} />
                    </td>
                    <td className="px-1 py-1">
                      <input className={cell} value={r.section ?? ''} onChange={(e) => update(r.key, { section: e.target.value })} />
                    </td>
                    <td className="px-3 py-1">
                      <div className="flex flex-wrap gap-1">
                        {issues.length === 0 && r.confidence !== 'low' && <Badge color="emerald">OK</Badge>}
                        {source === 'ai' && r.confidence === 'low' && <Badge color="amber">Low confidence</Badge>}
                        {issues.map((x) => (
                          <Badge key={x} color={x === 'Already in class' ? 'sky' : 'rose'}>
                            {x}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-2">
                      <button
                        type="button"
                        onClick={() => remove(r.key)}
                        className="grid size-8 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove row"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={addRow}>
            <Plus /> Add row
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>IDs already in class:</span>
            <select
              value={onDuplicate}
              onChange={(e) => setOnDuplicate(e.target.value as 'update' | 'skip')}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="skip">Keep existing</option>
              <option value="update">Update name/email</option>
            </select>
          </div>
        </div>
        {blocking > 0 && (
          <p className="text-sm font-medium text-rose-600">Fix {blocking} highlighted rows (missing or duplicate IDs) to continue.</p>
        )}
      </div>
    </Dialog>
  );
};
