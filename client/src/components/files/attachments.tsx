'use client';

import { useRef, useState } from 'react';
import { Archive, Download, File, FileImage, FileSpreadsheet, FileText, Loader2, Paperclip, Presentation, X } from 'lucide-react';
import { toast } from 'sonner';
import { ACCEPT, formatBytes, uploadFile } from '@/lib/upload';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Attachment, FileKind } from '@/lib/types';

const KIND: Record<FileKind, { icon: React.ReactNode; tone: string; label: string }> = {
  image: { icon: <FileImage />, tone: 'bg-violet-50 text-violet-600', label: 'Image' },
  pdf: { icon: <FileText />, tone: 'bg-rose-50 text-rose-600', label: 'PDF' },
  doc: { icon: <FileText />, tone: 'bg-sky-50 text-sky-600', label: 'Word' },
  sheet: { icon: <FileSpreadsheet />, tone: 'bg-emerald-50 text-emerald-600', label: 'Sheet' },
  slides: { icon: <Presentation />, tone: 'bg-orange-50 text-orange-600', label: 'Slides' },
  archive: { icon: <Archive />, tone: 'bg-amber-50 text-amber-700', label: 'ZIP' },
  text: { icon: <FileText />, tone: 'bg-slate-100 text-slate-600', label: 'Text' },
  other: { icon: <File />, tone: 'bg-slate-100 text-slate-600', label: 'File' },
};

export const fileMeta = (kind: FileKind) => KIND[kind] ?? KIND.other;

/** Read-only list of files: image thumbnails + file chips that download/open. */
export const AttachmentList = ({ items, compact }: { items: Attachment[]; compact?: boolean }) => {
  if (!items?.length) return null;
  const images = items.filter((a) => a.kind === 'image');
  const files = items.filter((a) => a.kind !== 'image');
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className={cn('grid gap-2', images.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}>
          {images.map((a) => (
            <a
              key={a.file + a.url}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl ring-1 ring-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- user uploads from Cloudinary/server */}
              <img
                src={a.url}
                alt={a.name}
                loading="lazy"
                className={cn('w-full object-cover transition group-hover:scale-[1.02]', compact ? 'h-28' : 'max-h-72')}
              />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className={cn('grid gap-2', !compact && 'sm:grid-cols-2')}>
          {files.map((a) => {
            const m = fileMeta(a.kind);
            return (
              <a
                key={a.file + a.url}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                download={a.name}
                className="group hover:ring-brand-300 flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 transition"
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[18px]', m.tone)}>{m.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{a.name}</span>
                  <span className="block text-xs text-slate-500">
                    {m.label} · {formatBytes(a.size)}
                  </span>
                </span>
                <Download className="group-hover:text-brand-600 size-4 shrink-0 text-slate-400" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export interface PendingFile {
  key: string;
  name: string;
  size: number;
  kind?: FileKind;
  progress: number;
  id?: string; // set when uploaded
  url?: string;
  error?: string;
}

/**
 * Pick + upload files immediately (shows progress). The parent keeps the list and sends the ids on save.
 * Already-attached files can be passed in `value` with their id.
 */
export const FilePicker = ({
  classId,
  value,
  onChange,
  max = 10,
  label = 'Attach files',
}: {
  classId?: string;
  value: PendingFile[];
  onChange: (next: PendingFile[] | ((prev: PendingFile[]) => PendingFile[])) => void;
  max?: number;
  label?: string;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const files = [...list].slice(0, Math.max(0, max - value.length));
    if (list.length > files.length) toast.error(`You can attach up to ${max} files`);
    files.forEach((file) => {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      onChange((prev) => [...prev, { key, name: file.name, size: file.size, progress: 0 }]);
      uploadFile(file, classId, (pct) => onChange((prev) => prev.map((p) => (p.key === key ? { ...p, progress: pct } : p))))
        .then((up) =>
          onChange((prev) => prev.map((p) => (p.key === key ? { ...p, id: up._id, url: up.url, kind: up.kind, progress: 100 } : p))),
        )
        .catch((err) => {
          toast.error(errorMessage(err));
          onChange((prev) => prev.filter((p) => p.key !== key));
        });
    });
    if (input.current) input.current.value = '';
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-sm font-semibold transition',
          dragging
            ? 'border-brand-400 bg-brand-50 text-brand-700'
            : 'hover:border-brand-300 hover:text-brand-700 border-slate-200 text-slate-500',
        )}
      >
        <Paperclip className="size-4" /> {label}
        <span className="font-normal text-slate-400">PDF, Word, slides, sheets, ZIP, images · max 10 MB</span>
      </button>
      <input ref={input} type="file" multiple hidden accept={ACCEPT} onChange={(e) => add(e.target.files)} />
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((f) => {
            const m = fileMeta(f.kind ?? 'other');
            const done = Boolean(f.id);
            return (
              <li key={f.key} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4', m.tone)}>
                  {done ? m.icon : <Loader2 className="animate-spin" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{f.name}</span>
                  {done ? (
                    <span className="block text-xs text-slate-500">{formatBytes(f.size)}</span>
                  ) : (
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <span className="bg-brand-500 block h-full rounded-full transition-all" style={{ width: `${f.progress}%` }} />
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onChange((prev) => prev.filter((p) => p.key !== f.key))}
                  className="grid size-7 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const fromAttachments = (items: Attachment[] = []): PendingFile[] =>
  items.map((a) => ({ key: a.file, id: a.file, name: a.name, size: a.size, kind: a.kind, url: a.url, progress: 100 }));
export const uploadingCount = (files: PendingFile[]) => files.filter((f) => !f.id).length;
