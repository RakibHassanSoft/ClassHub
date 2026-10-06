'use client';

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, Check, CheckCheck, ChevronDown, Copy, Loader2, Lock, MessagesSquare, Reply, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-store';
import { del, errorMessage, get, post } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { qk, useConversation } from '@/hooks/queries';
import { EmptyState, Spinner } from '@/components/ui/misc';
import { Menu } from '@/components/ui/menu';
import { AiSummary } from '@/components/ai/ai-summary';
import { cn, firstName } from '@/lib/utils';
import { ClassworkChatCard } from './classwork-chat-card';
import { ChatComposer, type OutgoingMessage } from './chat-composer';
import { FileChip, ImageGrid, LinkCard, MessageText, ReplyQuote, firstLink } from './message-content';
import { PollCard } from './poll';
import type { ChatMessage, ConversationDetail, ReadState } from '@/lib/types';

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const NAME_COLORS = ['text-emerald-700', 'text-sky-700', 'text-violet-700', 'text-amber-700', 'text-rose-700', 'text-teal-700', 'text-indigo-700', 'text-orange-700'];
const nameColor = (id = '') => NAME_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_COLORS.length];

const seenCount = (m: ChatMessage, reads: ReadState[]) =>
  reads.filter((r) => new Date(r.at).getTime() >= new Date(m.createdAt).getTime()).length;

type Page = { items: ChatMessage[]; hasMore: boolean; reads?: ReadState[] };

export const ChatThread = ({ conversationId, className }: { conversationId: string; className?: string }) => {
  const me = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const { data: conv, error: convError } = useConversation(conversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<ReadState[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = useCallback(() => {
    post(`/chat/conversations/${conversationId}/read`)
      .then(() => qc.invalidateQueries({ queryKey: qk.conversations }))
      .catch(() => undefined);
  }, [conversationId, qc]);

  // initial load
  useEffect(() => {
    let alive = true;
    get<Page>(`/chat/conversations/${conversationId}/messages`, { limit: 40 })
      .then((res) => {
        if (!alive) return;
        setMessages(res.items);
        setReads(res.reads ?? []);
        setHasMore(res.hasMore);
        stickToBottom.current = true;
        markRead();
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [conversationId, markRead]);

  // live updates
  useEffect(() => {
    if (!token) return undefined;
    const socket = getSocket(token);
    const join = () => socket.emit('conversation:join', conversationId);
    join();
    socket.on('connect', join);

    const onMessage = (e: Event) => {
      const { conversationId: cid, message } = (e as CustomEvent<{ conversationId: string; message: ChatMessage }>).detail;
      if (cid !== conversationId) return;
      setMessages((list) => (list.some((m) => m._id === message._id) ? list : [...list, message]));
      setTyping(null);
      if (document.visibilityState === 'visible') markRead();
    };
    const onDeleted = (e: Event) => {
      const { conversationId: cid, messageId } = (e as CustomEvent<{ conversationId: string; messageId: string }>).detail;
      if (cid !== conversationId) return;
      setMessages((list) =>
        list.map((m) => (m._id === messageId ? { ...m, deleted: true, text: '', attachments: [], poll: null, summary: null } : m)),
      );
    };
    const onUpdated = (e: Event) => {
      const { conversationId: cid, messageId, patch } = (
        e as CustomEvent<{ conversationId: string; messageId: string; patch: Partial<ChatMessage> }>
      ).detail;
      if (cid !== conversationId) return;
      setMessages((list) => list.map((m) => (m._id === messageId ? { ...m, ...patch } : m)));
    };
    const onRead = (e: Event) => {
      const { conversationId: cid, userId, at } = (e as CustomEvent<{ conversationId: string; userId: string; at: string }>).detail;
      if (cid !== conversationId || userId === me?._id) return;
      setReads((list) => [...list.filter((r) => r.user !== userId), { user: userId, at }]);
    };
    const onTyping = (p: { conversationId: string; name: string }) => {
      if (p.conversationId !== conversationId) return;
      setTyping(p.name);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(null), 3500);
    };

    window.addEventListener('classhub:message', onMessage);
    window.addEventListener('classhub:message-deleted', onDeleted);
    window.addEventListener('classhub:message-updated', onUpdated);
    window.addEventListener('classhub:conversation-read', onRead);
    socket.on('typing', onTyping);
    return () => {
      socket.emit('conversation:leave', conversationId);
      socket.off('connect', join);
      socket.off('typing', onTyping);
      window.removeEventListener('classhub:message', onMessage);
      window.removeEventListener('classhub:message-deleted', onDeleted);
      window.removeEventListener('classhub:message-updated', onUpdated);
      window.removeEventListener('classhub:conversation-read', onRead);
    };
  }, [conversationId, token, markRead, me?._id]);

  // keep scrolled to the newest message
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // images load after the first scroll: stay at the bottom while content grows
  const content = useRef<HTMLDivElement>(null);
  const empty = messages.length === 0;
  useEffect(() => {
    const el = content.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const sc = scroller.current;
      if (sc && stickToBottom.current) sc.scrollTop = sc.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, empty]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (!messages.length) return;
    setLoadingOlder(true);
    const el = scroller.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const res = await get<Page>(`/chat/conversations/${conversationId}/messages`, { limit: 40, before: messages[0].createdAt });
      stickToBottom.current = false;
      setMessages((list) => [...res.items, ...list]);
      setHasMore(res.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (m: OutgoingMessage) => {
    try {
      const res = await post<ChatMessage>(`/chat/conversations/${conversationId}/messages`, m);
      stickToBottom.current = true;
      setReplyTo(null);
      setMessages((list) => (list.some((x) => x._id === res.data._id) ? list : [...list, res.data]));
      qc.invalidateQueries({ queryKey: qk.conversations });
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  };

  const onTyping = () => {
    const now = Date.now();
    if (token && now - lastTypingSent.current > 2500) {
      lastTypingSent.current = now;
      getSocket(token).emit('typing', { conversationId, name: firstName(me?.name) || 'Someone' });
    }
  };

  const remove = async (m: ChatMessage) => {
    try {
      await del(`/chat/messages/${m._id}`);
      setMessages((list) => list.map((x) => (x._id === m._id ? { ...x, deleted: true, text: '', attachments: [], poll: null, summary: null } : x)));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) {
      toast.info('That message is further up. Load earlier messages to see it.');
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(id);
    setTimeout(() => setFlash(null), 1600);
  };

  if (convError) {
    return <EmptyState icon={<Lock />} title="Conversation not available" description={errorMessage(convError)} className={className} />;
  }

  const isGroup = conv?.type === 'class';

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div ref={scroller} onScroll={onScroll} className="chat-wallpaper min-h-0 flex-1 scrollbar-thin overflow-y-auto px-2 py-3 sm:px-6">
        {loading ? (
          <div className="grid h-full place-items-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare />}
            title={isGroup ? 'Start the class conversation' : 'No messages yet'}
            description={
              isGroup
                ? 'Everyone in the class sees messages here. Share photos, PDFs, documents, links and polls.'
                : 'Messages here are private between the two of you.'
            }
          />
        ) : (
          <div ref={content} className="mx-auto max-w-3xl">
            {hasMore && (
              <div className="flex justify-center pb-3">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingOlder}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-slate-900"
                >
                  {loadingOlder && <Loader2 className="size-3.5 animate-spin" />} Load earlier messages
                </button>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              const first =
                newDay ||
                prev?.sender?._id !== m.sender?._id ||
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
              return (
                <Fragment key={m._id}>
                  {newDay && (
                    <div className="flex justify-center py-2">
                      <span className="rounded-lg bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200/70">
                        {dayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <Bubble
                    m={m}
                    conv={conv}
                    meId={me?._id}
                    first={first}
                    isGroup={isGroup}
                    seen={seenCount(m, reads)}
                    flash={flash === m._id}
                    onReply={() => setReplyTo(m)}
                    onDelete={() => remove(m)}
                    onJump={jumpTo}
                    onPoll={(poll) => setMessages((list) => list.map((x) => (x._id === m._id ? { ...x, poll } : x)))}
                  />
                </Fragment>
              );
            })}
            {typing && (
              <div className="flex items-center gap-2 pt-2 pl-1 text-xs text-slate-500">
                <span className="flex gap-0.5 rounded-full bg-white px-2.5 py-2 shadow-sm">
                  <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
                </span>
                {typing} is typing…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/80 bg-[#f6f8f7] px-2 py-2.5 sm:px-4">
        {conv && !conv.canPost ? (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm text-slate-500 ring-1 ring-slate-200">
            <Lock className="size-4" /> Only teachers can post in this class chat
          </p>
        ) : conv ? (
          <ChatComposer
            classId={conv.classroom._id}
            canPoll={Boolean(conv.canPoll)}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSend={send}
            onTyping={onTyping}
          />
        ) : null}
      </div>
    </div>
  );
};

/** Single grey tick = sent, double blue ticks = seen (in groups: seen by at least one person). */
const Ticks = ({ seen, isGroup, light }: { seen: number; isGroup: boolean; light?: boolean }) => {
  if (!seen) return <Check className={cn('size-3.5', light ? 'text-white/85' : 'text-slate-400')} aria-label="Sent" />;
  const label = isGroup ? `Seen by ${seen}` : 'Seen';
  return (
    <span title={label} className="inline-flex">
      <CheckCheck className={cn('size-3.5', light ? 'text-sky-300' : 'text-sky-500')} aria-label={label} />
    </span>
  );
};

const Bubble = ({
  m,
  conv,
  meId,
  first,
  isGroup,
  seen,
  flash,
  onReply,
  onDelete,
  onJump,
  onPoll,
}: {
  m: ChatMessage;
  conv?: ConversationDetail;
  meId?: string;
  first: boolean;
  isGroup: boolean;
  seen: number;
  flash: boolean;
  onReply: () => void;
  onDelete: () => void;
  onJump: (id: string) => void;
  onPoll: (poll: NonNullable<ChatMessage['poll']>) => void;
}) => {
  const mine = m.sender?._id === meId;
  const isTeacher = conv?.myRole === 'teacher';
  const images = (m.attachments ?? []).filter((a) => a.kind === 'image');
  const docs = (m.attachments ?? []).filter((a) => a.kind !== 'image');
  const link = !m.kind || m.kind === 'text' ? firstLink(m.text) : undefined;
  const mediaOnly = images.length > 0 && !m.text && !docs.length;
  const wide = m.kind === 'poll' || m.kind === 'classwork' || images.length > 0 || docs.length > 0;
  const showText = Boolean(m.text) && m.kind !== 'classwork';

  const copy = () => {
    navigator.clipboard
      ?.writeText(m.text || m.poll?.question || '')
      .then(() => toast.success('Copied'))
      .catch(() => undefined);
  };

  return (
    <div id={`msg-${m._id}`} className={cn('group flex', mine ? 'justify-end' : 'justify-start', first ? 'mt-2' : 'mt-0.5')}>
      <div
        className={cn(
          'relative max-w-[88%] rounded-xl px-1.5 pt-1.5 pb-1 text-[14.5px] leading-snug text-slate-800 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-shadow sm:max-w-[70%]',
          mine ? 'bg-[#d9fdd3]' : 'bg-white',
          first && (mine ? 'rounded-tr-none' : 'rounded-tl-none'),
          wide && 'sm:min-w-64',
          flash && 'ring-brand-400 ring-4',
        )}
        data-testid="chat-bubble"
      >
        {first && (
          <span
            aria-hidden
            className={cn(
              'absolute top-0 size-2.5',
              mine ? '-right-2 bg-[#d9fdd3] [clip-path:polygon(0_0,100%_0,0_100%)]' : '-left-2 bg-white [clip-path:polygon(0_0,100%_0,100%_100%)]',
            )}
          />
        )}

        {!m.deleted && (
          <div className="absolute top-1 right-1 z-10 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            <Menu
              trigger={<ChevronDown className="size-4" />}
              className={cn(
                '[&>button]:size-6 [&>button]:rounded-full [&>button]:text-slate-500 [&>button]:shadow-sm',
                mine ? '[&>button]:bg-[#d9fdd3]' : '[&>button]:bg-white',
              )}
              align={mine ? 'right' : 'left'}
              items={[
                { label: 'Reply', icon: <Reply />, onClick: onReply, hidden: conv?.canPost === false },
                { label: 'Copy text', icon: <Copy />, onClick: copy, hidden: !m.text && !m.poll },
                { label: 'Delete', icon: <Trash2 />, onClick: onDelete, danger: true, hidden: !mine && !isTeacher },
              ]}
            />
          </div>
        )}

        {isGroup && !mine && first && (
          <p className={cn('flex items-center gap-1.5 px-1.5 pr-7 pb-0.5 text-[13px] font-semibold', nameColor(m.sender?._id))}>
            {m.sender?.name}
            {m.sender?.role === 'teacher' && (
              <span className="bg-brand-50 text-brand-700 ring-brand-200 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide uppercase ring-1">
                Teacher
              </span>
            )}
          </p>
        )}

        {m.deleted ? (
          <p className="flex items-center gap-1.5 px-1.5 pb-0.5 text-[13.5px] text-slate-500 italic">
            <Ban className="size-3.5" /> This message was deleted
            <span className="ml-2 text-[11px] text-slate-400 not-italic">{clock(m.createdAt)}</span>
          </p>
        ) : (
          <>
            {m.replyTo && <ReplyQuote reply={m.replyTo} onClick={() => onJump(m.replyTo!.id)} className="mb-1" />}

            {m.kind === 'classwork' && m.ref && conv && (
              <div className="mb-1">
                <ClassworkChatCard m={m} classId={conv.classroom._id} mine={false} />
              </div>
            )}

            {m.kind === 'poll' && m.poll && (
              <div className="px-1.5 pt-0.5 pb-1">
                <PollCard messageId={m._id} poll={m.poll} meId={meId} canClose={mine || isTeacher} onChange={onPoll} />
              </div>
            )}

            {images.length > 0 && (
              <div className="relative">
                <ImageGrid images={images} />
                {mediaOnly && (
                  <span className="absolute right-1.5 bottom-1.5 flex items-center gap-1 rounded-full bg-slate-900/45 px-1.5 py-0.5 text-[11px] text-white">
                    {clock(m.createdAt)}
                    {mine && <Ticks seen={seen} isGroup={isGroup} light />}
                  </span>
                )}
              </div>
            )}

            {docs.length > 0 && (
              <div className={cn('space-y-1', images.length > 0 && 'mt-1')}>
                {docs.map((a) => (
                  <FileChip key={a.file + a.url} a={a} />
                ))}
              </div>
            )}

            {link && <LinkCard url={link} />}

            {showText && (
              <div className={cn('px-1.5', (images.length > 0 || docs.length > 0) && 'pt-1', !first || !isGroup || mine ? 'pr-6' : '')}>
                <MessageText text={m.text} />
                {!m.summary && <span className="inline-block w-16" aria-hidden />}
              </div>
            )}

            {m.summary && <AiSummary text={m.summary} className="mx-0.5 mt-1.5 mb-0.5" />}

            {!mediaOnly && (
              <div
                className={cn(
                  'flex items-center justify-end gap-1 px-1.5 text-[11px] text-slate-500',
                  showText && !m.summary ? '-mt-4' : 'mt-0.5',
                )}
              >
                {clock(m.createdAt)}
                {mine && <Ticks seen={seen} isGroup={isGroup} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
