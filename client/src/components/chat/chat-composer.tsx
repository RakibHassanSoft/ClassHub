'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import {
  BarChart3,
  FileText,
  ImageIcon,
  Languages,
  Loader2,
  Minimize2,
  Paperclip,
  Plus,
  Reply,
  SendHorizontal,
  Smile,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, post } from '@/lib/api';
import { ACCEPT, MAX_UPLOAD_MB, formatBytes, uploadFile } from '@/lib/upload';
import { useAiStatus } from '@/hooks/queries';
import { fileMeta } from '@/components/files/attachments';
import { cn } from '@/lib/utils';
import { PollDialog } from './poll';
import type { ChatMessage, FileKind } from '@/lib/types';

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif';
const MAX_FILES = 10;

export interface OutgoingMessage {
  text: string;
  attachmentIds?: string[];
  replyTo?: string;
  poll?: { question: string; options: string[]; multiple: boolean };
}

interface Pending {
  key: string;
  name: string;
  size: number;
  kind: FileKind;
  preview?: string;
  progress: number;
  id?: string;
}

const guessKind = (file: File): FileKind => {
  if (file.type.startsWith('image/')) return 'image';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx'].includes(ext)) return 'slides';
  if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
  if (ext === 'txt') return 'text';
  return 'other';
};

const AI_MODES = [
  { mode: 'polish', label: 'Fix & make clear', hint: 'Correct grammar and spelling', icon: <Wand2 /> },
  { mode: 'english', label: 'Write in English', hint: 'Bangla / Banglish to clear English', icon: <Languages /> },
  { mode: 'polite', label: 'Make it polite', hint: 'Respectful tone for a teacher', icon: <Smile /> },
  { mode: 'shorter', label: 'Make it shorter', hint: 'Keep only what matters', icon: <Minimize2 /> },
] as const;
type AiMode = (typeof AI_MODES)[number]['mode'];

const QUICK_EMOJI = ['👍', '🙏', '✅', '😊', '👏', '🎉', '❤️', '🤔'];

/** WhatsApp-style message box: attach photos/documents, polls, reply, emoji and the AI writing helper. */
export const ChatComposer = ({
  classId,
  canPoll,
  replyTo,
  onCancelReply,
  onSend,
  onTyping,
}: {
  classId: string;
  canPoll: boolean;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  onSend: (m: OutgoingMessage) => Promise<boolean>;
  onTyping: () => void;
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Pending[]>([]);
  const [sending, setSending] = useState(0);
  const [menu, setMenu] = useState<'attach' | 'ai' | 'emoji' | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [ai, setAi] = useState<{ mode: AiMode; loading: boolean; text?: string; original: string } | null>(null);
  const { data: aiStatus } = useAiStatus();
  const imageInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // close popovers on outside click
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  useEffect(() => {
    if (replyTo) box.current?.focus();
  }, [replyTo]);

  const addFiles = (list: FileList | File[] | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    const room = MAX_FILES - files.length;
    if (room <= 0) return toast.error(`You can send up to ${MAX_FILES} files at once`);
    picked.slice(0, room).forEach((file) => {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${MAX_UPLOAD_MB} MB`);
        return;
      }
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const kind = guessKind(file);
      setFiles((l) => [...l, { key, name: file.name, size: file.size, kind, progress: 0, preview: kind === 'image' ? URL.createObjectURL(file) : undefined }]);
      uploadFile(file, classId, (p) => setFiles((l) => l.map((f) => (f.key === key ? { ...f, progress: p } : f))))
        .then((up) => setFiles((l) => l.map((f) => (f.key === key ? { ...f, id: up._id, progress: 100 } : f))))
        .catch((err) => {
          toast.error(errorMessage(err));
          setFiles((l) => l.filter((f) => f.key !== key));
        });
    });
    setMenu(null);
  };

  const removeFile = (key: string) =>
    setFiles((l) => {
      const f = l.find((x) => x.key === key);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return l.filter((x) => x.key !== key);
    });

  const uploading = files.some((f) => !f.id);
  const canSend = (text.trim().length > 0 || files.length > 0) && !uploading;

  /** Clears the box right away (like WhatsApp) and puts the text back if sending fails. */
  const send = async () => {
    if (!canSend) return;
    const draft = { text, files };
    setText('');
    setFiles([]);
    setAi(null);
    setSending((n) => n + 1);
    const ok = await onSend({
      text: draft.text.trim(),
      attachmentIds: draft.files.map((f) => f.id!).filter(Boolean),
      replyTo: replyTo?._id,
    });
    setSending((n) => n - 1);
    if (ok) draft.files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    else {
      setText((t) => t || draft.text);
      setFiles((l) => (l.length ? l : draft.files));
    }
    box.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) {
      e.preventDefault();
      send();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  const askAi = async (mode: AiMode) => {
    const original = text.trim();
    setMenu(null);
    if (original.length < 2) {
      toast.info('Type your message first — even in Bangla or broken English. AI will make it clear.');
      box.current?.focus();
      return;
    }
    setAi({ mode, loading: true, original });
    try {
      const res = await post<{ text: string }>('/ai/compose', { text: original, mode });
      setAi({ mode, loading: false, text: res.data.text, original });
    } catch (err) {
      setAi(null);
      toast.error(errorMessage(err));
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = box.current;
    if (!el) return setText((t) => t + emoji);
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const aiEnabled = aiStatus?.enabled ?? false;

  return (
    <div ref={wrap} className="relative mx-auto max-w-3xl">
      {/* AI suggestion */}
      {ai && (
        <div className="animate-slide-up mb-2 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-violet-200">
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-violet-50 to-sky-50 px-3.5 py-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-violet-700">
              <Sparkles className="size-3.5" /> AI suggestion · {AI_MODES.find((m) => m.mode === ai.mode)?.label}
            </p>
            <button type="button" onClick={() => setAi(null)} className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700" aria-label="Close suggestion">
              <X className="size-4" />
            </button>
          </div>
          <div className="px-3.5 py-3">
            {ai.loading ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin text-violet-500" /> Writing a better version…
              </p>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-800">{ai.text}</p>
            )}
          </div>
          {!ai.loading && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setText(ai.text ?? '');
                  setAi(null);
                  box.current?.focus();
                }}
                className="cursor-pointer rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Use this
              </button>
              <button
                type="button"
                onClick={() => askAi(ai.mode)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50"
              >
                Try again
              </button>
              <span className="ml-auto text-[11px] text-slate-400">Check it before sending</span>
            </div>
          )}
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-white px-2 py-1.5 ring-1 ring-slate-200">
          <Reply className="text-brand-600 ml-1 size-4 shrink-0" />
          <div className="border-brand-500 min-w-0 flex-1 border-l-4 pl-2.5">
            <p className="text-brand-700 truncate text-xs font-bold">Replying to {replyTo.sender?.name}</p>
            <p className="truncate text-xs text-slate-500">
              {replyTo.kind === 'poll' ? `Poll: ${replyTo.poll?.question}` : replyTo.text || (replyTo.kind === 'image' ? 'Photo' : replyTo.attachments?.[0]?.name || 'Message')}
            </p>
          </div>
          <button type="button" onClick={onCancelReply} className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cancel reply">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Files waiting to be sent */}
      {files.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto rounded-xl bg-white p-2 ring-1 ring-slate-200">
          {files.map((f) => {
            const m = fileMeta(f.kind);
            return (
              <div key={f.key} className="relative w-28 shrink-0">
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview
                  <img src={f.preview} alt={f.name} className="h-20 w-28 rounded-lg object-cover ring-1 ring-slate-200" />
                ) : (
                  <div className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg bg-slate-50 px-2 ring-1 ring-slate-200">
                    <span className={cn('grid size-8 place-items-center rounded-lg [&_svg]:size-4', m.tone)}>{m.icon}</span>
                    <span className="w-full truncate text-center text-[11px] font-medium text-slate-700">{f.name}</span>
                    <span className="text-[10px] text-slate-400">{formatBytes(f.size)}</span>
                  </div>
                )}
                {!f.id && (
                  <div className="absolute inset-0 grid place-items-center rounded-lg bg-white/70">
                    <span className="text-brand-700 text-xs font-bold">{f.progress}%</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(f.key)}
                  className="absolute -top-1.5 -right-1.5 grid size-5 cursor-pointer place-items-center rounded-full bg-slate-800 text-white shadow"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attach */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu(menu === 'attach' ? null : 'attach')}
            className={cn(
              'grid size-11 cursor-pointer place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800',
              menu === 'attach' && 'bg-slate-100 text-slate-800',
            )}
            aria-label="Attach"
            aria-expanded={menu === 'attach'}
          >
            <Plus className={cn('size-6 transition-transform', menu === 'attach' && 'rotate-45')} />
          </button>
          {menu === 'attach' && (
            <div className="animate-slide-up absolute bottom-14 left-0 z-20 w-56 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200">
              <AttachItem icon={<ImageIcon />} tone="bg-violet-500" label="Photos" hint="JPG, PNG, WEBP" onClick={() => imageInput.current?.click()} />
              <AttachItem icon={<FileText />} tone="bg-sky-500" label="Document" hint="PDF, Word, PPT, Excel, ZIP" onClick={() => docInput.current?.click()} />
              {canPoll && (
                <AttachItem
                  icon={<BarChart3 />}
                  tone="bg-amber-500"
                  label="Poll"
                  hint="Ask the class to vote"
                  onClick={() => {
                    setMenu(null);
                    setPollOpen(true);
                  }}
                />
              )}
            </div>
          )}
          <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
          <input ref={docInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
        </div>

        {/* Text box */}
        <div className="focus-within:border-brand-400 focus-within:ring-brand-500/10 flex min-h-11 min-w-0 flex-1 items-end rounded-3xl border border-slate-200 bg-white transition focus-within:ring-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu(menu === 'emoji' ? null : 'emoji')}
              className="grid size-11 cursor-pointer place-items-center rounded-full text-slate-400 hover:text-slate-700"
              aria-label="Emoji"
            >
              <Smile className="size-5" />
            </button>
            {menu === 'emoji' && (
              <div className="animate-slide-up absolute bottom-12 left-0 z-20 grid grid-cols-4 gap-1 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
                {QUICK_EMOJI.map((e) => (
                  <button key={e} type="button" onClick={() => insertEmoji(e)} className="grid size-10 cursor-pointer place-items-center rounded-xl text-xl hover:bg-slate-100">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            ref={box}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value) onTyping();
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={1}
            cols={1}
            maxLength={4000}
            placeholder={files.length ? 'Add a caption…' : 'Message'}
            className="[field-sizing:content] max-h-40 min-h-11 w-0 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
            aria-label="Message"
          />
          {aiEnabled && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu(menu === 'ai' ? null : 'ai')}
                className={cn(
                  'm-1 flex h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-bold text-violet-600 transition hover:bg-violet-50',
                  menu === 'ai' && 'bg-violet-50',
                )}
                aria-label="AI writing help"
                title="AI writing help"
              >
                <Sparkles className="size-4" />
                <span className="hidden sm:inline">AI</span>
              </button>
              {menu === 'ai' && (
                <div className="animate-slide-up absolute right-0 bottom-12 z-20 w-64 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200">
                  <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold text-slate-500">Not sure how to write it? Let AI help.</p>
                  {AI_MODES.map((m) => (
                    <button
                      key={m.mode}
                      type="button"
                      onClick={() => askAi(m.mode)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-violet-50"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600 [&_svg]:size-4">{m.icon}</span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{m.label}</span>
                        <span className="block text-[11px] text-slate-500">{m.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!aiEnabled && (
            <button
              type="button"
              onClick={() => docInput.current?.click()}
              className="grid size-11 cursor-pointer place-items-center rounded-full text-slate-400 hover:text-slate-700"
              aria-label="Attach a file"
            >
              <Paperclip className="size-5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="bg-brand-600 hover:bg-brand-700 shadow-brand grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send"
          title={uploading ? 'Wait for the upload to finish' : 'Send'}
        >
          {sending > 0 || uploading ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
        </button>
      </div>

      <PollDialog
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        onCreate={(poll) => onSend({ text: '', poll })}
      />
    </div>
  );
};

const AttachItem = ({ icon, tone, label, hint, onClick }: { icon: React.ReactNode; tone: string; label: string; hint: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50">
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-white [&_svg]:size-[18px]', tone)}>{icon}</span>
    <span>
      <span className="block text-sm font-semibold text-slate-800">{label}</span>
      <span className="block text-[11px] text-slate-500">{hint}</span>
    </span>
  </button>
);
