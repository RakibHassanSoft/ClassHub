import {
  AlertTriangle,
  BellRing,
  BookOpenCheck,
  ClipboardPen,
  FileCheck2,
  NotebookPen,
  Paperclip,
  CalendarClock,
  CalendarX2,
  ClipboardList,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  Link2,
  Megaphone,
  Presentation,
  StickyNote,
} from 'lucide-react';
import type { AssessmentCategory, ClassworkType, DriveType, NoticeType, Resource, SlotType } from './types';

export const NOTICE_META: Record<NoticeType, { label: string; color: string; icon: React.ReactNode; ring: string; iconBg: string }> = {
  general: {
    label: 'Announcement',
    color: 'emerald',
    icon: <Megaphone />,
    ring: 'ring-slate-200',
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  note: { label: 'Note', color: 'sky', icon: <StickyNote />, ring: 'ring-slate-200', iconBg: 'bg-sky-50 text-sky-600' },
  cancel: { label: 'Class cancelled', color: 'rose', icon: <CalendarX2 />, ring: 'ring-rose-200', iconBg: 'bg-rose-50 text-rose-600' },
  reschedule: {
    label: 'Rescheduled',
    color: 'amber',
    icon: <CalendarClock />,
    ring: 'ring-amber-200',
    iconBg: 'bg-amber-50 text-amber-600',
  },
  urgent: { label: 'Urgent', color: 'rose', icon: <AlertTriangle />, ring: 'ring-rose-300', iconBg: 'bg-rose-500 text-white' },
  reminder: { label: 'Reminder', color: 'violet', icon: <BellRing />, ring: 'ring-violet-200', iconBg: 'bg-violet-50 text-violet-600' },
};

export const DRIVE_META: Record<DriveType | 'link' | 'note', { label: string; icon: React.ReactNode; tone: string }> = {
  folder: { label: 'Drive folder', icon: <Folder />, tone: 'bg-amber-50 text-amber-600 ring-amber-100' },
  document: { label: 'Google Doc', icon: <FileText />, tone: 'bg-sky-50 text-sky-600 ring-sky-100' },
  spreadsheet: { label: 'Google Sheet', icon: <FileSpreadsheet />, tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
  presentation: { label: 'Google Slides', icon: <Presentation />, tone: 'bg-amber-50 text-orange-600 ring-orange-100' },
  form: { label: 'Google Form', icon: <ClipboardList />, tone: 'bg-violet-50 text-violet-600 ring-violet-100' },
  file: { label: 'Drive file', icon: <File />, tone: 'bg-slate-100 text-slate-600 ring-slate-200' },
  link: { label: 'Link', icon: <Link2 />, tone: 'bg-teal-50 text-teal-600 ring-teal-100' },
  note: { label: 'Note', icon: <StickyNote />, tone: 'bg-yellow-50 text-yellow-700 ring-yellow-100' },
};

const UPLOAD_META = { label: 'Uploaded file', icon: <Paperclip />, tone: 'bg-amber-50 text-amber-600 ring-amber-100' };
export const resourceMeta = (r: Pick<Resource, 'kind' | 'driveType'>) =>
  r.kind === 'file' ? UPLOAD_META : r.kind === 'drive' ? DRIVE_META[r.driveType ?? 'file'] : DRIVE_META[r.kind];

/** Same detection as the server so the form can preview the type. */
export const detectDriveType = (raw: string): DriveType | null => {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'drive.google.com') return url.pathname.includes('/folders/') ? 'folder' : 'file';
    if (host === 'docs.google.com') {
      if (url.pathname.startsWith('/document')) return 'document';
      if (url.pathname.startsWith('/spreadsheets')) return 'spreadsheet';
      if (url.pathname.startsWith('/presentation')) return 'presentation';
      if (url.pathname.startsWith('/forms')) return 'form';
      return 'file';
    }
    if (host === 'forms.gle') return 'form';
  } catch {
    /* not a url yet */
  }
  return null;
};

export const CATEGORY_LABEL: Record<AssessmentCategory, string> = {
  quiz: 'Quiz',
  assignment: 'Assignment',
  mid: 'Mid-term',
  final: 'Final',
  lab: 'Lab',
  presentation: 'Presentation',
  project: 'Project',
  other: 'Other',
};

export const SLOT_META: Record<SlotType, { label: string; color: string }> = {
  theory: { label: 'Theory', color: 'emerald' },
  lab: { label: 'Lab', color: 'violet' },
  tutorial: { label: 'Tutorial', color: 'sky' },
  other: { label: 'Other', color: 'slate' },
};

export const CLASSWORK_META: Record<ClassworkType, { label: string; plural: string; icon: React.ReactNode; tone: string; color: string }> =
  {
    class_log: {
      label: 'Class diary',
      plural: 'Class diary',
      icon: <NotebookPen />,
      tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      color: 'emerald',
    },
    homework: { label: 'Homework', plural: 'Homework', icon: <ClipboardPen />, tone: 'bg-sky-50 text-sky-600 ring-sky-100', color: 'sky' },
    class_test: {
      label: 'Class test',
      plural: 'Class tests',
      icon: <FileCheck2 />,
      tone: 'bg-rose-50 text-rose-600 ring-rose-100',
      color: 'rose',
    },
    exam_syllabus: {
      label: 'Exam syllabus',
      plural: 'Syllabus',
      icon: <BookOpenCheck />,
      tone: 'bg-violet-50 text-violet-600 ring-violet-100',
      color: 'violet',
    },
    material: {
      label: 'Material',
      plural: 'Materials',
      icon: <Paperclip />,
      tone: 'bg-amber-50 text-amber-600 ring-amber-100',
      color: 'amber',
    },
  };

/** "2026-10-08T10:00:00.000Z" -> "Wed, 8 Oct · 4:00 PM" in the viewer's time zone. */
export const formatDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';

/** ISO -> value for <input type="datetime-local"> (local time). */
export const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/** "in 2 days", "3 hours ago" */
export const relativeTime = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [86400_000, 'day'],
    [3600_000, 'hour'],
    [60_000, 'minute'],
  ];
  for (const [ms, name] of units) {
    if (abs >= ms) {
      const n = Math.round(abs / ms);
      const label = `${n} ${name}${n > 1 ? 's' : ''}`;
      return diff > 0 ? `in ${label}` : `${label} ago`;
    }
  }
  return diff > 0 ? 'in a moment' : 'just now';
};
