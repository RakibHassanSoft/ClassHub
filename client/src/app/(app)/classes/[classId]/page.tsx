'use client';

import { AiSummary } from '@/components/ai/ai-summary';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ExternalLink, Eye, Info, Megaphone, Pencil, Pin, PinOff, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClassContext } from '@/components/class/class-context';
import { useAuth } from '@/lib/auth-store';
import { qk, useNotices, useRoutine } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/misc';
import { Menu } from '@/components/ui/menu';
import { Badge } from '@/components/ui/badge';
import { del, errorMessage, patch, post } from '@/lib/api';
import { NOTICE_META } from '@/lib/meta';
import { cn, DAYS, formatTime, timeAgo } from '@/lib/utils';
import type { Notice, NoticeType } from '@/lib/types';

const TYPES: NoticeType[] = ['general', 'note', 'cancel', 'reschedule', 'urgent'];

const emptyForm = { type: 'general' as NoticeType, title: '', body: '', link: '', pinned: false };

const NoticeForm = ({
  value,
  onChange,
  compact,
  allowUrgent = true,
}: {
  value: typeof emptyForm;
  onChange: (v: typeof emptyForm) => void;
  compact?: boolean;
  allowUrgent?: boolean;
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {TYPES.filter((t) => allowUrgent || t !== 'urgent').map((t) => {
        const meta = NOTICE_META[t];
        const active = value.type === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...value, type: t })}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition [&_svg]:size-3.5',
              active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300',
            )}
          >
            {meta.icon}
            {meta.label}
          </button>
        );
      })}
    </div>
    <Input
      required
      placeholder={value.type === 'cancel' ? 'e.g. No class on Thursday (12 Oct)' : 'Title'}
      value={value.title}
      onChange={(e) => onChange({ ...value, title: e.target.value })}
    />
    <Textarea
      placeholder="Write details for your students (optional)"
      value={value.body}
      onChange={(e) => onChange({ ...value, body: e.target.value })}
      className={compact ? 'min-h-20' : undefined}
    />
    <Input
      type="url"
      placeholder="Attach a link — Drive, Google Meet, form… (optional)"
      value={value.link}
      onChange={(e) => onChange({ ...value, link: e.target.value })}
    />
  </div>
);

const NoticeCard = ({
  n,
  isTeacher,
  canManage,
  onEdit,
  onDelete,
  onPin,
}: {
  n: Notice;
  isTeacher: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
}) => {
  const meta = NOTICE_META[n.type];
  return (
    <article
      className={cn(
        'shadow-soft rounded-2xl border bg-white p-5 transition',
        n.type === 'urgent' ? 'border-rose-200 ring-1 ring-rose-100' : n.type === 'cancel' ? 'border-rose-100' : 'border-slate-200/80',
      )}
    >
      <div className="flex items-start gap-3.5">
        <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]', meta.iconBg)}>{meta.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={meta.color}>{meta.label}</Badge>
            {n.pinned && (
              <Badge color="slate">
                <Pin /> Pinned
              </Badge>
            )}
            <span className="text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
          </div>
          <h3 className="mt-2 text-[15px] leading-snug font-bold">{n.title}</h3>
          <AiSummary text={n.summary} className="mt-2" />
          {n.body && <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-slate-600">{n.body}</p>}
          {n.link && (
            <a
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 hover:bg-brand-50 mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{n.link.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Avatar name={n.author?.name} size="sm" className="size-6 text-[10px] ring-1" />
            {n.author?.name}
            {isTeacher && n.seenCount !== undefined && (
              <span className="ml-auto flex items-center gap-1 font-medium">
                <Eye className="size-3.5" /> Seen by {Math.max(0, n.seenCount - 1)}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <Menu
            items={[
              { label: n.pinned ? 'Unpin' : 'Pin to top', icon: n.pinned ? <PinOff /> : <Pin />, onClick: onPin, hidden: !isTeacher },
              { label: 'Edit', icon: <Pencil />, onClick: onEdit },
              { label: 'Delete', icon: <Trash2 />, onClick: onDelete, danger: true },
            ]}
          />
        )}
      </div>
    </article>
  );
};

export default function StreamPage() {
  const { classroom, isTeacher } = useClassContext();
  const isCR = Boolean(classroom.isCR);
  const canPost = isTeacher || isCR;
  const me = useAuth((s) => s.user);
  const id = classroom._id;
  const qc = useQueryClient();
  const { data: notices, isLoading } = useNotices(id);
  const { data: routine } = useRoutine(id);
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.notices(id) });
    qc.invalidateQueries({ queryKey: qk.feed });
  };

  // students: mark visible notices as seen
  useEffect(() => {
    if (isTeacher || !notices) return;
    const unseen = notices.filter((n) => !n.seen);
    if (!unseen.length) return;
    Promise.all(unseen.map((n) => post(`/classes/${id}/notices/${n._id}/seen`)))
      .then(() => qc.invalidateQueries({ queryKey: qk.feed }))
      .catch(() => undefined);
  }, [notices, isTeacher, id, qc]);

  const clean = (f: typeof emptyForm) => ({ ...f, body: f.body || undefined, link: f.link || '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPosting(true);
    try {
      await post(`/classes/${id}/notices`, clean(form));
      toast.success('Notice posted to all students');
      setForm(emptyForm);
      setExpanded(false);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await patch(`/classes/${id}/notices/${editing._id}`, clean(editForm));
      toast.success('Notice updated');
      setEditing(null);
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
      await del(`/classes/${id}/notices/${deleting._id}`);
      toast.success('Notice deleted');
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (n: Notice) => {
    try {
      await patch(`/classes/${id}/notices/${n._id}`, { pinned: !n.pinned });
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const today = new Date().getDay();
  const nextSlots = [...(routine ?? [])]
    .sort((a, b) => ((a.day - today + 7) % 7) - ((b.day - today + 7) % 7) || a.startTime.localeCompare(b.startTime))
    .slice(0, 3);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {canPost && (
          <Card className="p-4 sm:p-5">
            {!expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="hover:border-brand-400 hover:bg-brand-50/40 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3.5 text-left text-sm text-slate-500 transition"
              >
                <Megaphone className="text-brand-600 size-5" />
                Post a notice: class cancelled, notes, urgent update…
              </button>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <NoticeForm value={form} onChange={setForm} allowUrgent={isTeacher} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.pinned}
                      onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                      className="size-4 accent-emerald-600"
                    />
                    Pin to top
                  </label>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setExpanded(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={posting} variant={form.type === 'urgent' ? 'danger' : 'primary'}>
                      <Send /> Post
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </Card>
        )}

        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)
        ) : !notices?.length ? (
          <Card>
            <EmptyState
              icon={<Megaphone />}
              title="No notices yet"
              description={
                isTeacher
                  ? 'Announcements you post appear here and in every student’s notifications.'
                  : 'Your teacher’s announcements will appear here.'
              }
            />
          </Card>
        ) : (
          notices.map((n) => (
            <NoticeCard
              key={n._id}
              n={n}
              isTeacher={isTeacher}
              canManage={isTeacher || (isCR && n.author?._id === me?._id)}
              onPin={() => togglePin(n)}
              onDelete={() => setDeleting(n)}
              onEdit={() => {
                setEditForm({ type: n.type, title: n.title, body: n.body ?? '', link: n.link ?? '', pinned: n.pinned });
                setEditing(n);
              }}
            />
          ))
        )}
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader
            title="Upcoming"
            icon={<CalendarDays />}
            action={
              <Link href={`/classes/${id}/routine`} className="text-brand-600 text-sm font-semibold">
                Routine
              </Link>
            }
          />
          <div className="p-5 pt-4">
            {nextSlots.length === 0 ? (
              <p className="text-sm text-slate-500">{isTeacher ? 'Add class times in Routine.' : 'No class times yet.'}</p>
            ) : (
              <ul className="space-y-3">
                {nextSlots.map((s) => (
                  <li key={s._id} className="flex items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-50 text-center ring-1 ring-slate-200">
                      <span className="text-[11px] leading-none font-bold text-slate-700 uppercase">{DAYS[s.day].slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {[s.room, s.type !== 'theory' && s.type].filter(Boolean).join(' · ') || 'Class'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        {classroom.description && (
          <Card>
            <CardHeader title="About this class" icon={<Info />} />
            <p className="p-5 pt-3 text-sm leading-relaxed whitespace-pre-line text-slate-600">{classroom.description}</p>
          </Card>
        )}
      </aside>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit notice"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        <Field>
          <NoticeForm value={editForm} onChange={setEditForm} compact allowUrgent={isTeacher} />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title="Delete this notice?"
        description="Students will no longer see it."
      />
    </div>
  );
}
