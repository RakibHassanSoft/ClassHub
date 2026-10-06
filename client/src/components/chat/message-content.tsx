'use client';

import { Fragment, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, Download, ExternalLink, FileText, ImageIcon, X } from 'lucide-react';
import { useIsClient } from '@/hooks/use-is-client';
import { fileMeta } from '@/components/files/attachments';
import { formatBytes } from '@/lib/upload';
import { cn } from '@/lib/utils';
import type { Attachment, ChatMessage } from '@/lib/types';

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** Text with clickable links (http/https only). */
export const Linkified = ({ text }: { text: string }) => {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium [overflow-wrap:anywhere] text-sky-700 underline decoration-sky-300 underline-offset-2 hover:decoration-sky-600"
          >
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
};

export const firstLink = (text: string) => text.match(URL_RE)?.[0];

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const LINK_NAMES: [RegExp, string][] = [
  [/drive\.google\.com|docs\.google\.com/, 'Google Drive'],
  [/meet\.google\.com/, 'Google Meet'],
  [/forms\.gle|forms\.google/, 'Google Form'],
  [/youtube\.com|youtu\.be/, 'YouTube'],
  [/github\.com/, 'GitHub'],
  [/classroom\.google\.com/, 'Google Classroom'],
];

/** Small card under a message that contains a link. */
export const LinkCard = ({ url }: { url: string }) => {
  const host = hostOf(url);
  const name = LINK_NAMES.find(([re]) => re.test(host))?.[1];
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1 flex items-center gap-2.5 rounded-lg bg-black/[0.04] px-2.5 py-2 transition hover:bg-black/[0.07]"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-sky-600 ring-1 ring-slate-200">
        <ExternalLink className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-slate-800">{name ?? host}</span>
        <span className="block truncate text-[11px] text-slate-500">{url.replace(/^https?:\/\//, '')}</span>
      </span>
    </a>
  );
};

/** Full-screen photo viewer. */
const Lightbox = ({ image, onClose }: { image: Attachment; onClose: () => void }) => {
  const mounted = useIsClient();
  if (!mounted) return null;
  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-[80] flex flex-col bg-slate-950/90" onClick={onClose} role="dialog" aria-label={image.name}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="truncate text-sm font-medium">{image.name}</p>
        <div className="flex items-center gap-1">
          <a
            href={image.url}
            download={image.name}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-10 place-items-center rounded-full hover:bg-white/10"
            aria-label="Download"
          >
            <Download className="size-5" />
          </a>
          <button type="button" onClick={onClose} className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-white/10" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- user uploads */}
        <img src={image.url} alt={image.name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>,
    document.body,
  );
};

export const ImageGrid = ({ images }: { images: Attachment[] }) => {
  const [open, setOpen] = useState<Attachment | null>(null);
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;
  return (
    <>
      <div className={cn('grid gap-1 overflow-hidden rounded-lg', shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
        {shown.map((a, i) => (
          <button
            key={a.file + a.url}
            type="button"
            onClick={() => setOpen(a)}
            className={cn('relative block cursor-zoom-in overflow-hidden bg-slate-100', shown.length === 3 && i === 0 && 'col-span-2')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user uploads */}
            <img
              src={a.url}
              alt={a.name}
              loading="lazy"
              className={cn('w-full object-cover', shown.length === 1 ? 'max-h-80 min-h-32' : 'h-32 sm:h-36')}
            />
            {extra > 0 && i === shown.length - 1 && (
              <span className="absolute inset-0 grid place-items-center bg-slate-900/50 text-2xl font-bold text-white">+{extra}</span>
            )}
          </button>
        ))}
      </div>
      {open && <Lightbox image={open} onClose={() => setOpen(null)} />}
    </>
  );
};

export const FileChip = ({ a }: { a: Attachment }) => {
  const m = fileMeta(a.kind);
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      download={a.name}
      className="group flex items-center gap-3 rounded-lg bg-black/[0.04] px-2.5 py-2 transition hover:bg-black/[0.07]"
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5', m.tone)}>{m.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-slate-800">{a.name}</span>
        <span className="block text-[11px] text-slate-500">
          {m.label} · {formatBytes(a.size)}
        </span>
      </span>
      <span className="grid size-8 shrink-0 place-items-center rounded-full text-slate-500 ring-1 ring-slate-300 group-hover:text-slate-800">
        <Download className="size-4" />
      </span>
    </a>
  );
};

/** Quoted message inside a reply bubble or above the composer. */
export const ReplyQuote = ({
  reply,
  onClick,
  className,
}: {
  reply: NonNullable<ChatMessage['replyTo']>;
  onClick?: () => void;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'border-brand-500 block w-full cursor-pointer rounded-lg border-l-4 bg-black/[0.05] px-2.5 py-1.5 text-left transition hover:bg-black/[0.08]',
      className,
    )}
  >
    <span className="text-brand-700 block truncate text-xs font-bold">{reply.senderName}</span>
    <span className="flex items-center gap-1 text-xs text-slate-600">
      {reply.kind === 'image' && <ImageIcon className="size-3.5 shrink-0" />}
      {reply.kind === 'file' && <FileText className="size-3.5 shrink-0" />}
      {reply.kind === 'poll' && <BarChart3 className="size-3.5 shrink-0" />}
      <span className="line-clamp-2">{reply.text || 'Message'}</span>
    </span>
  </button>
);

const LONG = 700;

/** Long messages are collapsed with "Read more", like WhatsApp. */
export const MessageText = ({ text }: { text: string }) => {
  const [full, setFull] = useState(false);
  const long = text.length > LONG;
  return (
    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
      <Linkified text={long && !full ? `${text.slice(0, LONG).trimEnd()}… ` : text} />
      {long && (
        <button type="button" onClick={() => setFull((v) => !v)} className="text-brand-700 cursor-pointer text-[13px] font-semibold hover:underline">
          {full ? ' Show less' : 'Read more'}
        </button>
      )}
    </span>
  );
};
