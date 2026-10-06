'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileSpreadsheet,
  Link2Off,
  Pencil,
  Search,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useClassContext } from '@/components/class/class-context';
import { ImportPreviewDialog, type PreviewRow } from '@/components/class/import-preview';
import { qk, usePeople, useRoster } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Avatar, EmptyState, Skeleton, StatTile } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Menu } from '@/components/ui/menu';
import { api, del, errorMessage, patch, post } from '@/lib/api';
import { downloadExcel, readRosterFile } from '@/lib/export';
import type { ExtractedStudent, RosterEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

const emptyStudent = { studentId: '', name: '', email: '', phone: '', section: '' };

export default function StudentsPage() {
  const { classroom } = useClassContext();
  const id = classroom._id;
  const qc = useQueryClient();
  const { data: roster, isLoading } = useRoster(id);
  const { data: people } = usePeople(id);
  const crIds = useMemo(() => new Set((people?.representatives ?? []).map((p) => p._id)), [people]);

  const toggleCR = async (userId: string, isCR: boolean) => {
    try {
      const res = await patch(`/classes/${id}/members/${userId}`, { isCR });
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ['class', id, 'people'] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'joined' | 'pending'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RosterEntry | null>(null);
  const [form, setForm] = useState(emptyStudent);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<RosterEntry | null>(null);
  const [unlinking, setUnlinking] = useState<RosterEntry | null>(null);
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; source: 'csv' | 'ai'; notes?: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.roster(id) });
    qc.invalidateQueries({ queryKey: qk.class(id) });
    qc.invalidateQueries({ queryKey: qk.classes });
  };

  const existingIds = useMemo(() => new Set((roster ?? []).map((r) => r.studentId)), [roster]);
  const joined = (roster ?? []).filter((r) => r.claimedBy).length;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (roster ?? [])
      .filter((r) => (filter === 'joined' ? r.claimedBy : filter === 'pending' ? !r.claimedBy : true))
      .filter((r) => !term || [r.studentId, r.name, r.email, r.section].some((v) => v?.toLowerCase().includes(term)));
  }, [roster, q, filter]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyStudent);
    setFormOpen(true);
  };
  const openEdit = (r: RosterEntry) => {
    setEditing(r);
    setForm({ studentId: r.studentId, name: r.name, email: r.email ?? '', phone: r.phone ?? '', section: r.section ?? '' });
    setFormOpen(true);
  };

  const saveStudent = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || undefined]));
    try {
      if (editing) await patch(`/classes/${id}/roster/${editing._id}`, body);
      else await post(`/classes/${id}/roster`, body);
      toast.success(editing ? 'Student updated' : 'Student added');
      setFormOpen(false);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onSpreadsheet = async (file?: File) => {
    if (!file) return;
    try {
      const { rows } = await readRosterFile(file);
      if (!rows.length) {
        toast.error('No students found in this file');
        return;
      }
      setPreview({
        source: 'csv',
        rows: rows.map((r) => ({ ...r, key: crypto.randomUUID(), confidence: 'high', issues: [] })),
      });
    } catch {
      toast.error('Could not read this file. Use .csv, .xls or .xlsx');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onAiFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File is too large (max 10 MB)');
      return;
    }
    setAiLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post<{ data: { students: ExtractedStudent[]; notes?: string } }>(`/classes/${id}/roster/ai-extract`, fd, {
        timeout: 120_000,
      });
      const students = res.data.data.students;
      if (!students.length) {
        toast.error(res.data.data.notes || 'No students were found in this file');
        return;
      }
      setPreview({ source: 'ai', notes: res.data.data.notes, rows: students.map((s) => ({ ...s, key: crypto.randomUUID() })) });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAiLoading(false);
      if (aiRef.current) aiRef.current.value = '';
    }
  };

  const saveImport = async (rows: PreviewRow[], onDuplicate: 'update' | 'skip') => {
    setSaving(true);
    try {
      const res = await post<{ added: number; updated: number; skipped: number }>(`/classes/${id}/roster/bulk`, {
        source: preview?.source ?? 'csv',
        onDuplicate,
        rows: rows.map((r) => ({
          studentId: r.studentId.trim(),
          name: r.name.trim(),
          email: r.email?.trim() || undefined,
          phone: r.phone?.trim() || undefined,
          section: r.section?.trim() || undefined,
        })),
      });
      toast.success(res.message);
      setPreview(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setSaving(true);
    try {
      await del(`/classes/${id}/roster/${removing._id}`);
      toast.success('Student removed from class');
      setRemoving(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmUnlink = async () => {
    if (!unlinking) return;
    setSaving(true);
    try {
      await post(`/classes/${id}/roster/${unlinking._id}/unlink`);
      toast.success('Account unlinked. The student can join again.');
      setUnlinking(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const exportList = () => {
    downloadExcel(`${classroom.courseCode || classroom.title} - students`, [
      {
        name: 'Students',
        rows: [
          ['#', 'Student ID', 'Name', 'Email', 'Phone', 'Section', 'Joined'],
          ...(roster ?? []).map((r, i) => [
            i + 1,
            r.studentId,
            r.name,
            r.email ?? '',
            r.phone ?? '',
            r.section ?? '',
            r.claimedBy ? 'Yes' : 'No',
          ]),
        ],
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatTile label="On class list" value={roster?.length ?? '–'} icon={<Users />} />
        <StatTile label="Joined" value={joined} icon={<UserCheck />} accent="teal" />
        <StatTile label="Not joined yet" value={(roster?.length ?? 0) - joined} icon={<UserX />} accent="amber" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => aiRef.current?.click()}
          disabled={aiLoading}
          className="group from-brand-600 shadow-brand relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br to-teal-700 p-5 text-left text-white transition hover:-translate-y-0.5 disabled:cursor-wait"
        >
          <div className="absolute -top-8 -right-8 size-28 rounded-full bg-white/10 transition group-hover:scale-125" />
          <Sparkles className={cn('size-6', aiLoading && 'animate-pulse')} />
          <p className="font-display mt-3 font-bold">{aiLoading ? 'Reading your file…' : 'Import from PDF with AI'}</p>
          <p className="mt-1 text-sm text-white/80">
            {aiLoading ? 'Gemini is extracting students. This can take 10–40 seconds.' : 'Upload a PDF or photo of the student list.'}
          </p>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shadow-soft hover:shadow-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5"
        >
          <FileSpreadsheet className="size-6 text-emerald-600" />
          <p className="font-display mt-3 font-bold text-slate-900">Import CSV / Excel</p>
          <p className="mt-1 text-sm text-slate-500">Columns like ID, Name, Email are detected automatically.</p>
        </button>
        <button
          type="button"
          onClick={openAdd}
          className="shadow-soft hover:shadow-card cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5"
        >
          <UserPlus className="size-6 text-sky-600" />
          <p className="font-display mt-3 font-bold text-slate-900">Add one student</p>
          <p className="mt-1 text-sm text-slate-500">Type an ID and name manually.</p>
        </button>
        <input
          ref={aiRef}
          type="file"
          hidden
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => onAiFile(e.target.files?.[0])}
        />
        <input ref={fileRef} type="file" hidden accept=".csv,.xls,.xlsx" onChange={(e) => onSpreadsheet(e.target.files?.[0])} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {(
              [
                ['all', 'All'],
                ['joined', 'Joined'],
                ['pending', 'Not joined'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  'cursor-pointer rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
                  filter === k ? 'shadow-soft bg-white text-slate-900' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 sm:w-64">
              <Input placeholder="Search ID or name" icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Button variant="outline" size="icon" onClick={exportList} disabled={!roster?.length} aria-label="Download list">
              <Download />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !roster?.length ? (
          <EmptyState
            icon={<Users />}
            title="Your class list is empty"
            description="Add students using one of the options above. Only students on this list can join your class."
          />
        ) : list.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No students match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Section</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="w-12 px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => (
                  <tr key={r._id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{r.name}</p>
                          <p className="truncate text-xs text-slate-500">{r.claimedBy?.email || r.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[13px] text-slate-700">{r.studentId}</td>
                    <td className="px-5 py-3 text-slate-600">{r.section || '—'}</td>
                    <td className="px-5 py-3">
                      {r.claimedBy ? (
                        <Badge color="emerald">
                          <UserCheck /> Joined
                        </Badge>
                      ) : (
                        <Badge color="amber">Not joined</Badge>
                      )}
                      {r.claimedBy && crIds.has(r.claimedBy._id) && (
                        <Badge color="sky" className="ml-1.5">
                          <ShieldCheck /> CR
                        </Badge>
                      )}
                      {r.source === 'ai' && (
                        <Badge color="violet" className="ml-1.5">
                          <Sparkles /> AI
                        </Badge>
                      )}
                      {r.source === 'self' && (
                        <Badge color="teal" className="ml-1.5">
                          Joined by code
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Menu
                        items={[
                          { label: 'Edit', icon: <Pencil />, onClick: () => openEdit(r) },
                          {
                            label:
                              r.claimedBy && crIds.has(r.claimedBy._id) ? 'Remove as class representative' : 'Make class representative',
                            icon: r.claimedBy && crIds.has(r.claimedBy._id) ? <ShieldOff /> : <ShieldCheck />,
                            onClick: () => r.claimedBy && toggleCR(r.claimedBy._id, !crIds.has(r.claimedBy._id)),
                            hidden: !r.claimedBy,
                          },
                          { label: 'Unlink account', icon: <Link2Off />, onClick: () => setUnlinking(r), hidden: !r.claimedBy },
                          { label: 'Remove from class', icon: <Trash2 />, onClick: () => setRemoving(r), danger: true },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit student' : 'Add a student'}
        icon={editing ? <Pencil /> : <UserPlus />}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="student-form" loading={saving}>
              {editing ? 'Save' : 'Add student'}
            </Button>
          </>
        }
      >
        <form id="student-form" onSubmit={saveStudent} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Register ID" required>
              <Input
                required
                className="font-mono"
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              />
            </Field>
            <Field label="Section">
              <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
            </Field>
          </div>
          <Field label="Full name" required>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
        </form>
      </Dialog>

      {preview && (
        <ImportPreviewDialog
          open
          onClose={() => setPreview(null)}
          rows={preview.rows}
          source={preview.source}
          notes={preview.notes}
          existingIds={existingIds}
          onSave={saveImport}
          saving={saving}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        loading={saving}
        title={`Remove ${removing?.name}?`}
        description="They will lose access to this class. Past attendance records are kept."
        confirmLabel="Remove"
      />
      <ConfirmDialog
        open={Boolean(unlinking)}
        onClose={() => setUnlinking(null)}
        onConfirm={confirmUnlink}
        loading={saving}
        tone="primary"
        title="Unlink this account?"
        description={`${unlinking?.claimedBy?.name ?? 'The student'} will be removed from the class, and ID ${unlinking?.studentId} can be used to join again (for example from a new account).`}
        confirmLabel="Unlink"
      />
    </div>
  );
}
