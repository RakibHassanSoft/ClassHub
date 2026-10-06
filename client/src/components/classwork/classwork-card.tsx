'use client';

import { CalendarClock, CheckCircle2, Clock, ExternalLink, Pencil, Pin, Trash2, Users } from 'lucide-react';
import { AttachmentList } from '@/components/files/attachments';
import { Badge } from '@/components/ui/badge';
import { Menu } from '@/components/ui/menu';
import { CLASSWORK_META, formatDateTime, relativeTime } from '@/lib/meta';
import { cn, formatIsoDate } from '@/lib/utils';
import type { ClassworkItem } from '@/lib/types';

/** Status a student sees on a homework card. */
export const homeworkStatus = (w: ClassworkItem) => {
  const sub = w.mySubmission;
  if (sub?.gradedAt)
    return { label: sub.score != null ? `Marked ${sub.score}${w.maxScore != null ? `/${w.maxScore}` : ''}` : 'Checked', color: 'violet' };
  if (sub) return { label: sub.late ? 'Submitted late' : 'Submitted', color: sub.late ? 'amber' : 'emerald' };
  if (w.dueAt && new Date(w.dueAt) < new Date()) return { label: w.allowLate ? 'Missing · late allowed' : 'Missing', color: 'rose' };
  return { label: 'Assigned', color: 'sky' };
};

export const ClassworkCard = ({
  w,
  isTeacher,
  onOpen,
  onEdit,
  onDelete,
}: {
  w: ClassworkItem;
  isTeacher: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const meta = CLASSWORK_META[w.type];
  const when =
    w.type === 'homework'
      ? w.dueAt
        ? { icon: <Clock />, text: `Due ${formatDateTime(w.dueAt)}`, sub: relativeTime(w.dueAt), past: new Date(w.dueAt) < new Date() }
        : { icon: <Clock />, text: 'No deadline' }
      : w.type === 'class_test' || (w.type === 'exam_syllabus' && w.eventAt)
        ? {
            icon: <CalendarClock />,
            text: formatDateTime(w.eventAt),
            sub: w.eventAt ? relativeTime(w.eventAt) : '',
            past: Boolean(w.eventAt && new Date(w.eventAt) < new Date()),
          }
        : w.type === 'class_log'
          ? { icon: <CalendarClock />, text: formatIsoDate(w.date) }
          : null;
  const status = !isTeacher && w.type === 'homework' && w.allowSubmission ? homeworkStatus(w) : null;

  return (
    <article className="group shadow-soft hover:shadow-card rounded-2xl border border-slate-200/80 bg-white transition">
      <div className="flex gap-3.5 p-4 sm:p-5">
        <button
          type="button"
          onClick={onOpen}
          className={cn('grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl ring-1 [&_svg]:size-5', meta.tone)}
          aria-label="Open"
        >
          {meta.icon}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={meta.color}>
              {w.type === 'exam_syllabus' && w.examType
                ? w.examType === 'mid'
                  ? 'Mid-term syllabus'
                  : w.examType === 'final'
                    ? 'Final syllabus'
                    : 'Exam syllabus'
                : meta.label}
            </Badge>
            {w.pinned && (
              <Badge color="slate">
                <Pin /> Pinned
              </Badge>
            )}
            {status && <Badge color={status.color}>{status.label}</Badge>}
          </div>
          <button type="button" onClick={onOpen} className="mt-1.5 block cursor-pointer text-left">
            <h3 className="hover:text-brand-700 text-[15px] leading-snug font-bold">{w.title}</h3>
          </button>
          {when && (
            <p
              className={cn(
                'mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5',
                when.past ? 'text-rose-600' : 'text-slate-500',
              )}
            >
              {when.icon} {when.text}
              {when.sub && <span className="text-slate-400">· {when.sub}</span>}
            </p>
          )}
          {w.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-slate-600">{w.description}</p>}
          {w.attachments.length > 0 && (
            <div className="mt-3">
              <AttachmentList items={w.attachments} compact />
            </div>
          )}
          {w.links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {w.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 hover:bg-brand-50 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold ring-1 ring-slate-200"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  <span className="truncate">{l.title || l.url.replace(/^https?:\/\//, '')}</span>
                </a>
              ))}
            </div>
          )}
          {isTeacher && w.type === 'homework' && w.stats && (
            <button
              type="button"
              onClick={onOpen}
              className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100"
            >
              <Users className="size-3.5" /> {w.stats.submitted}/{w.stats.students} submitted
              {w.stats.late > 0 && <span className="text-amber-700">· {w.stats.late} late</span>}
            </button>
          )}
          {!isTeacher && w.type === 'homework' && w.allowSubmission && !w.mySubmission && (
            <button
              type="button"
              onClick={onOpen}
              className="bg-brand-600 hover:bg-brand-700 mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            >
              <CheckCircle2 className="size-3.5" /> Submit homework
            </button>
          )}
        </div>
        {isTeacher && (
          <Menu
            items={[
              { label: 'Edit', icon: <Pencil />, onClick: onEdit },
              { label: 'Delete', icon: <Trash2 />, onClick: onDelete, danger: true },
            ]}
          />
        )}
      </div>
    </article>
  );
};
