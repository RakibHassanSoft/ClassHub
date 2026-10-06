'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Clock, Download, ExternalLink, MessageSquareText, Send, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { AttachmentList, FilePicker, uploadingCount, type PendingFile } from '@/components/files/attachments';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, PageLoader } from '@/components/ui/misc';
import { del, errorMessage, get, patch, post } from '@/lib/api';
import { CLASSWORK_META, formatDateTime, relativeTime } from '@/lib/meta';
import { cn, formatIsoDate } from '@/lib/utils';
import type { ClassworkItem, SubmissionRow } from '@/lib/types';
import { homeworkStatus } from './classwork-card';

const STATUS: Record<SubmissionRow['status'], { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: 'emerald' },
  late: { label: 'Late', color: 'amber' },
  missing: { label: 'Missing', color: 'rose' },
  pending: { label: 'Not yet', color: 'slate' },
  not_joined: { label: 'Not joined', color: 'slate' },
};

const StudentSubmit = ({ classId, w }: { classId: string; w: ClassworkItem }) => {
  const qc = useQueryClient();
  const [text, setText] = useState(w.mySubmission?.text ?? '');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const sub = w.mySubmission;
  const closed = Boolean(w.dueAt && new Date(w.dueAt) < new Date() && !w.allowLate);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['class', classId, 'classwork'] });
    qc.invalidateQueries({ queryKey: ['classwork', 'upcoming'] });
  };

  const submit = async () => {
    if (uploadingCount(files)) return toast.error('Wait for the files to finish uploading');
    setBusy(true);
    try {
      const res = await post(`/classes/${classId}/classwork/${w._id}/submission`, {
        text: text.trim() || undefined,
        attachmentIds: files.filter((f) => f.id).map((f) => f.id!),
      });
      toast.success(res.message);
      setFiles([]);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const unsubmit = async () => {
    setBusy(true);
    try {
      await del(`/classes/${classId}/classwork/${w._id}/submission`);
      toast.success('Submission removed — you can submit again');
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const status = homeworkStatus(w);
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="font-display font-bold text-slate-900">Your work</p>
        <Badge color={status.color}>{status.label}</Badge>
      </div>
      {sub ? (
        <div className="space-y-3">
          {sub.text && (
            <p className="rounded-xl bg-white p-3 text-sm whitespace-pre-line text-slate-700 ring-1 ring-slate-200">{sub.text}</p>
          )}
          <AttachmentList items={sub.attachments} compact />
          <p className="text-xs text-slate-500">
            Submitted {formatDateTime(sub.submittedAt)}
            {sub.late && ' · late'}
          </p>
          {sub.gradedAt && (
            <div className="rounded-xl bg-violet-50 p-3 text-sm ring-1 ring-violet-200">
              <p className="font-bold text-violet-900">
                {sub.score != null ? `Marks: ${sub.score}${w.maxScore != null ? ` / ${w.maxScore}` : ''}` : 'Checked by teacher'}
              </p>
              {sub.feedback && <p className="mt-1 text-violet-800">“{sub.feedback}”</p>}
            </div>
          )}
          {!sub.gradedAt && !(w.dueAt && new Date(w.dueAt) < new Date()) && (
            <Button variant="outline" size="sm" onClick={unsubmit} loading={busy}>
              <Undo2 /> Unsubmit to change
            </Button>
          )}
        </div>
      ) : closed ? (
        <p className="text-sm text-rose-700">The deadline has passed and late submissions are closed.</p>
      ) : (
        <div className="space-y-3">
          <Textarea
            placeholder="Write your answer or a note to your teacher (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <FilePicker classId={classId} value={files} onChange={setFiles} label="Add your files" max={10} />
          <Button className="w-full" onClick={submit} loading={busy} disabled={!text.trim() && !files.some((f) => f.id)}>
            <Send /> {w.dueAt && new Date(w.dueAt) < new Date() ? 'Submit late' : 'Submit'}
          </Button>
        </div>
      )}
    </div>
  );
};

const TeacherSubmissions = ({ classId, w }: { classId: string; w: ClassworkItem }) => {
  const qc = useQueryClient();
  const key = ['class', classId, 'classwork', w._id, 'submissions'];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => get<{ rows: SubmissionRow[] }>(`/classes/${classId}/classwork/${w._id}/submissions`),
  });
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { score: string; feedback: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [dueDraft, setDueDraft] = useState<string | null>(null);

  const save = async (subId: string) => {
    const d = draft[subId];
    setBusy(subId);
    try {
      await patch(`/classes/${classId}/classwork/${w._id}/submissions/${subId}`, {
        score: d.score === '' ? null : Number(d.score),
        feedback: d.feedback,
      });
      toast.success('Saved and sent to the student');
      qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const saveDeadline = async () => {
    setBusy('due');
    try {
      await patch(`/classes/${classId}/classwork/${w._id}`, { dueAt: dueDraft ? new Date(dueDraft).toISOString() : null });
      toast.success('Deadline updated — students were notified');
      setDueDraft(null);
      qc.invalidateQueries({ queryKey: ['class', classId, 'classwork'] });
      qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !data) return <PageLoader />;
  const counts = data.rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">Deadline</p>
          {dueDraft === null ? (
            <p className="font-semibold text-slate-800">{w.dueAt ? formatDateTime(w.dueAt) : 'No deadline'}</p>
          ) : (
            <Input type="datetime-local" value={dueDraft} onChange={(e) => setDueDraft(e.target.value)} className="mt-1 h-10" />
          )}
        </div>
        {dueDraft === null ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDueDraft(
                w.dueAt ? new Date(new Date(w.dueAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
              )
            }
          >
            <Clock /> Change deadline
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDueDraft(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveDeadline} loading={busy === 'due'}>
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['submitted', 'late', 'missing', 'pending', 'not_joined'] as const).map((s) =>
          counts[s] ? (
            <Badge key={s} color={STATUS[s].color}>
              {STATUS[s].label}: {counts[s]}
            </Badge>
          ) : null,
        )}
      </div>

      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
        {data.rows.map((r) => {
          const sub = r.submission;
          const isOpen = open === r.entry;
          const d = sub ? (draft[sub._id] ?? { score: sub.score != null ? String(sub.score) : '', feedback: sub.feedback ?? '' }) : null;
          return (
            <li key={r.entry} className="p-3 sm:p-4">
              <button
                type="button"
                disabled={!sub}
                onClick={() => setOpen(isOpen ? null : r.entry)}
                className="flex w-full cursor-pointer items-center gap-3 text-left disabled:cursor-default"
              >
                <Avatar name={r.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{r.name}</span>
                  <span className="block font-mono text-xs text-slate-500">{r.studentId}</span>
                </span>
                {sub?.gradedAt && sub.score != null && (
                  <span className="text-sm font-bold text-violet-700 tabular-nums">
                    {sub.score}
                    {w.maxScore != null ? `/${w.maxScore}` : ''}
                  </span>
                )}
                <Badge color={STATUS[r.status].color}>{STATUS[r.status].label}</Badge>
              </button>
              {isOpen && sub && d && (
                <div className="mt-3 space-y-3 pl-11">
                  {sub.text && (
                    <p className="rounded-xl bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-700 ring-1 ring-slate-200">
                      {sub.text}
                    </p>
                  )}
                  <AttachmentList items={sub.attachments} compact />
                  <p className="text-xs text-slate-500">
                    Submitted {formatDateTime(sub.submittedAt)} {sub.late && '· late'}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                    <Input
                      type="number"
                      min="0"
                      placeholder={w.maxScore != null ? `/ ${w.maxScore}` : 'Marks'}
                      value={d.score}
                      onChange={(e) => setDraft({ ...draft, [sub._id]: { ...d, score: e.target.value } })}
                      className="h-10"
                    />
                    <Input
                      placeholder="Feedback (optional)"
                      value={d.feedback}
                      onChange={(e) => setDraft({ ...draft, [sub._id]: { ...d, feedback: e.target.value } })}
                      className="h-10"
                    />
                    <Button size="sm" className="h-10" onClick={() => save(sub._id)} loading={busy === sub._id}>
                      Return
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** Full view of one classwork post (opened from Classwork, chat cards or notifications). */
export const ClassworkDetail = ({
  classId,
  id,
  isTeacher,
  onClose,
}: {
  classId: string;
  id: string;
  isTeacher: boolean;
  onClose: () => void;
}) => {
  const {
    data: w,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['class', classId, 'classwork', id],
    queryFn: () => get<ClassworkItem>(`/classes/${classId}/classwork/${id}`),
  });
  const meta = w ? CLASSWORK_META[w.type] : null;

  return (
    <Dialog open onClose={onClose} size="lg" title={w?.title ?? 'Loading…'} icon={meta?.icon} description={meta?.label}>
      {isLoading ? (
        <PageLoader />
      ) : error || !w ? (
        <p className="text-sm text-rose-600">{errorMessage(error, 'This post was deleted.')}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 [&_svg]:size-4">
            {w.type === 'class_log' && (
              <span className="flex items-center gap-1.5">
                <CalendarClock /> Class of {formatIsoDate(w.date)}
              </span>
            )}
            {w.dueAt && (
              <span
                className={cn(
                  'flex items-center gap-1.5 font-semibold',
                  new Date(w.dueAt) < new Date() ? 'text-rose-600' : 'text-slate-800',
                )}
              >
                <Clock /> Due {formatDateTime(w.dueAt)} ({relativeTime(w.dueAt)})
              </span>
            )}
            {w.eventAt && (
              <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                <CalendarClock /> {formatDateTime(w.eventAt)} ({relativeTime(w.eventAt)})
              </span>
            )}
            {w.maxScore != null && <span>Marks: {w.maxScore}</span>}
            <span className="text-slate-400">
              Posted by {w.createdBy?.name} · {formatDateTime(w.createdAt)}
            </span>
          </div>
          {w.description && <p className="text-[15px] leading-relaxed whitespace-pre-line text-slate-700">{w.description}</p>}
          {w.attachments.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
                <Download className="size-3.5" /> Files
              </p>
              <AttachmentList items={w.attachments} />
            </div>
          )}
          {w.links.length > 0 && (
            <div className="space-y-2">
              {w.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 hover:bg-brand-50 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold ring-1 ring-slate-200"
                >
                  <ExternalLink className="size-4 shrink-0" /> <span className="truncate">{l.title || l.url}</span>
                </a>
              ))}
            </div>
          )}
          {w.type === 'homework' &&
            w.allowSubmission &&
            (isTeacher ? <TeacherSubmissions classId={classId} w={w} /> : <StudentSubmit classId={classId} w={w} />)}
          {w.type === 'homework' && !w.allowSubmission && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <MessageSquareText className="size-4" /> No online submission for this homework.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
};
