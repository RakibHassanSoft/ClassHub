'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Link2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { FilePicker, fromAttachments, uploadingCount, type PendingFile } from '@/components/files/attachments';
import { errorMessage, patch, post } from '@/lib/api';
import { CLASSWORK_META, fromLocalInput, toLocalInput } from '@/lib/meta';
import { todayIso } from '@/lib/utils';
import type { ClassworkItem, ClassworkType } from '@/lib/types';

export type ComposerMode = ClassworkType | 'today';

interface FormState {
  title: string;
  description: string;
  date: string;
  dueAt: string;
  eventAt: string;
  examType: 'mid' | 'final' | 'other';
  allowLate: boolean;
  maxScore: string;
  links: { url: string; title: string }[];
  files: PendingFile[];
  notifyChat: boolean;
}

const blank = (date = todayIso()): FormState => ({
  title: '',
  description: '',
  date,
  dueAt: '',
  eventAt: '',
  examType: 'mid',
  allowLate: true,
  maxScore: '',
  links: [],
  files: [],
  notifyChat: true,
});

const fromItem = (w: ClassworkItem): FormState => ({
  title: w.title,
  description: w.description ?? '',
  date: w.date ?? todayIso(),
  dueAt: toLocalInput(w.dueAt),
  eventAt: toLocalInput(w.eventAt),
  examType: w.examType ?? 'mid',
  allowLate: w.allowLate,
  maxScore: w.maxScore != null ? String(w.maxScore) : '',
  links: w.links.map((l) => ({ url: l.url, title: l.title ?? '' })),
  files: fromAttachments(w.attachments),
  notifyChat: false,
});

const TITLE_HINT: Record<ClassworkType, string> = {
  class_log: 'Topic covered, e.g. Linked lists: insertion and deletion',
  homework: 'e.g. Implement a stack using arrays',
  class_test: 'e.g. CT-1',
  exam_syllabus: 'e.g. Mid-term syllabus',
  material: 'e.g. Week 3 lecture slides',
};

/** One dialog for every kind of classwork, plus the "Today's class" shortcut (diary + homework + files). */
export const ClassworkComposer = ({
  classId,
  mode,
  editing,
  onClose,
}: {
  classId: string;
  mode: ComposerMode;
  editing?: ClassworkItem | null;
  onClose: () => void;
}) => {
  const qc = useQueryClient();
  const type: ClassworkType = mode === 'today' ? 'class_log' : mode;
  const [form, setForm] = useState<FormState>(() => (editing ? fromItem(editing) : blank()));
  const [withHomework, setWithHomework] = useState(false);
  const [hw, setHw] = useState<FormState>(() => blank());
  const [saving, setSaving] = useState(false);
  const meta = CLASSWORK_META[type];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const payload = (t: ClassworkType, f: FormState) => ({
    title: f.title.trim(),
    description: f.description.trim() || undefined,
    ...(t === 'class_log' ? { date: f.date } : {}),
    ...(t === 'homework'
      ? { dueAt: fromLocalInput(f.dueAt), allowLate: f.allowLate, maxScore: f.maxScore === '' ? null : Number(f.maxScore) }
      : {}),
    ...(t === 'class_test' || t === 'exam_syllabus' ? { eventAt: fromLocalInput(f.eventAt) } : {}),
    ...(t === 'exam_syllabus' ? { examType: f.examType } : {}),
    links: f.links.filter((l) => l.url.trim()).map((l) => ({ url: l.url.trim(), title: l.title.trim() || undefined })),
    attachmentIds: f.files.filter((x) => x.id).map((x) => x.id!),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (uploadingCount(form.files) || uploadingCount(hw.files)) {
      toast.error('Wait for the files to finish uploading');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await patch(`/classes/${classId}/classwork/${editing._id}`, payload(type, form));
        toast.success('Saved');
      } else {
        await post(`/classes/${classId}/classwork`, { type, ...payload(type, form), notifyChat: form.notifyChat });
        if (mode === 'today' && withHomework && hw.title.trim()) {
          await post(`/classes/${classId}/classwork`, { type: 'homework', ...payload('homework', hw), notifyChat: form.notifyChat });
        }
        toast.success(mode === 'today' ? "Today's class saved and shared with students" : `${meta.label} posted to the class`);
      }
      qc.invalidateQueries({ queryKey: ['class', classId, 'classwork'] });
      qc.invalidateQueries({ queryKey: ['classwork', 'upcoming'] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const linkEditor = (f: FormState, update: (links: FormState['links']) => void) => (
    <div className="space-y-2">
      {f.links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex-1">
            <Input
              type="url"
              placeholder="https://drive.google.com/… or any link"
              icon={<Link2 />}
              value={l.url}
              onChange={(e) => update(f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
            />
          </div>
          <button
            type="button"
            onClick={() => update(f.links.filter((_, j) => j !== i))}
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Remove link"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      {f.links.length < 10 && (
        <Button size="sm" variant="ghost" onClick={() => update([...f.links, { url: '', title: '' }])}>
          <Plus /> Add link
        </Button>
      )}
    </div>
  );

  const title = editing ? `Edit ${meta.label.toLowerCase()}` : mode === 'today' ? "Today's class" : `New ${meta.label.toLowerCase()}`;

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={title}
      description={
        mode === 'today'
          ? 'Write what you covered, attach notes, and add homework in one go. Students see it in Classwork and the class chat.'
          : undefined
      }
      icon={meta.icon}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="classwork-form" loading={saving}>
            {editing ? 'Save changes' : 'Post'}
          </Button>
        </>
      }
    >
      <form id="classwork-form" onSubmit={submit} className="space-y-5">
        {type === 'class_log' && (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Class date" required>
              <Input type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
            <Field label="Topic covered" required>
              <Input required placeholder={TITLE_HINT.class_log} value={form.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
          </div>
        )}
        {type !== 'class_log' && (
          <Field label="Title" required>
            <Input required placeholder={TITLE_HINT[type]} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
        )}

        {type === 'exam_syllabus' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exam">
              <Select value={form.examType} onChange={(e) => set('examType', e.target.value as FormState['examType'])}>
                <option value="mid">Mid-term</option>
                <option value="final">Final</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Exam date & time" hint="Optional">
              <Input type="datetime-local" value={form.eventAt} onChange={(e) => set('eventAt', e.target.value)} />
            </Field>
          </div>
        )}
        {type === 'class_test' && (
          <Field label="Class test date & time" required>
            <Input type="datetime-local" required value={form.eventAt} onChange={(e) => set('eventAt', e.target.value)} />
          </Field>
        )}
        {type === 'homework' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Deadline" hint="Students can submit until this time">
              <Input type="datetime-local" value={form.dueAt} onChange={(e) => set('dueAt', e.target.value)} />
            </Field>
            <Field label="Marks (optional)">
              <Input type="number" min="0" placeholder="e.g. 10" value={form.maxScore} onChange={(e) => set('maxScore', e.target.value)} />
            </Field>
          </div>
        )}

        <Field
          label={
            type === 'class_test' || type === 'exam_syllabus'
              ? 'Syllabus / details'
              : type === 'class_log'
                ? 'Notes (optional)'
                : 'Description'
          }
        >
          <Textarea
            placeholder={
              type === 'class_test' || type === 'exam_syllabus'
                ? 'Chapters, topics, marks, rules…'
                : type === 'class_log'
                  ? 'What you explained, examples, anything students should revise'
                  : 'Instructions for students'
            }
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className="min-h-28"
          />
        </Field>

        <Field label="Files">
          <FilePicker
            classId={classId}
            value={form.files}
            onChange={(v) => setForm((f) => ({ ...f, files: typeof v === 'function' ? v(f.files) : v }))}
          />
        </Field>
        <Field label="Links">{linkEditor(form, (links) => set('links', links))}</Field>

        {type === 'homework' && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Accept late submissions</p>
              <p className="text-xs text-slate-500">Late work is marked “Late”. You can change the deadline any time.</p>
            </div>
            <Switch checked={form.allowLate} onChange={(v) => set('allowLate', v)} label="Accept late submissions" />
          </div>
        )}

        {mode === 'today' && !editing && (
          <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Add homework for this class</p>
                <p className="text-xs text-slate-500">Students can submit files before the deadline.</p>
              </div>
              <Switch checked={withHomework} onChange={setWithHomework} label="Add homework" />
            </div>
            {withHomework && (
              <div className="space-y-4">
                <Input placeholder="Homework title" value={hw.title} onChange={(e) => setHw({ ...hw, title: e.target.value })} required />
                <Textarea
                  placeholder="Instructions"
                  value={hw.description}
                  onChange={(e) => setHw({ ...hw, description: e.target.value })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Deadline">
                    <Input type="datetime-local" value={hw.dueAt} onChange={(e) => setHw({ ...hw, dueAt: e.target.value })} />
                  </Field>
                  <Field label="Marks (optional)">
                    <Input type="number" min="0" value={hw.maxScore} onChange={(e) => setHw({ ...hw, maxScore: e.target.value })} />
                  </Field>
                </div>
                <FilePicker
                  classId={classId}
                  value={hw.files}
                  onChange={(v) => setHw((f) => ({ ...f, files: typeof v === 'function' ? v(f.files) : v }))}
                  label="Homework files"
                />
              </div>
            )}
          </div>
        )}

        {mode === 'today' && !editing && (
          <Link
            href={`/classes/${classId}/attendance`}
            className="text-brand-700 hover:text-brand-800 flex items-center gap-2 text-sm font-semibold"
          >
            <ClipboardCheck className="size-4" /> Take today&apos;s attendance
          </Link>
        )}

        {!editing && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="size-4 accent-emerald-600"
              checked={form.notifyChat}
              onChange={(e) => set('notifyChat', e.target.checked)}
            />
            Also share in the class chat
          </label>
        )}
      </form>
    </Dialog>
  );
};
