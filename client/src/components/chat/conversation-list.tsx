'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessageSquarePlus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useClasses, useConversations } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { Avatar, EmptyState, Skeleton, Spinner } from '@/components/ui/misc';
import { errorMessage, get, post } from '@/lib/api';
import { swatch, tone } from '@/lib/colors';
import { cn, firstName, timeAgo } from '@/lib/utils';

const NewChatDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const router = useRouter();
  const { data: classes } = useClasses();
  const active = (classes ?? []).filter((c) => !c.archived);
  const [classId, setClassId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const selected = classId || active[0]?._id || '';

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['chat', 'contacts', selected],
    queryFn: () => get<{ _id: string; name: string; role: string; studentId?: string }[]>('/chat/contacts', { classId: selected }),
    enabled: open && Boolean(selected),
  });

  const start = async (userId: string) => {
    setBusy(userId);
    try {
      const res = await post<{ _id: string }>('/chat/direct', { classId: selected, userId });
      onClose();
      router.push(`/messages/${res.data._id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New private message"
      description="Pick a class, then the person you want to message."
      icon={<MessageSquarePlus />}
      size="sm"
    >
      <div className="space-y-4">
        <Field label="Class">
          <Select value={selected} onChange={(e) => setClassId(e.target.value)}>
            {active.map((c) => (
              <option key={c._id} value={c._id}>
                {c.courseCode ? `${c.courseCode} · ${c.title}` : c.title}
              </option>
            ))}
          </Select>
        </Field>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
          {isLoading ? (
            <div className="grid place-items-center py-8">
              <Spinner />
            </div>
          ) : !contacts?.length ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No one to message in this class yet (only joined students appear).
            </p>
          ) : (
            contacts.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => start(p._id)}
                disabled={Boolean(busy)}
                className="flex w-full cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50 disabled:opacity-60"
              >
                <Avatar name={p.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{p.role === 'student' ? p.studentId : p.role}</p>
                </div>
                {busy === p._id && <Spinner className="size-4" />}
              </button>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
};

export const ConversationList = ({ activeId }: { activeId?: string }) => {
  const { data, isLoading } = useConversations();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (c) => !term || c.title.toLowerCase().includes(term) || c.classroom?.title.toLowerCase().includes(term),
    );
  }, [data, q]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-slate-100 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold">Messages</h1>
          <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
            <MessageSquarePlus /> New
          </Button>
        </div>
        <Input placeholder="Search chats" icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} className="h-10" />
      </div>
      <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-2">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="m-2 h-14" />)
        ) : !items.length ? (
          <EmptyState icon={<Users />} title="No chats yet" description="Class group chats appear here once you join a class." />
        ) : (
          items.map((c) => (
            <Link
              key={c._id}
              href={`/messages/${c._id}`}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 transition',
                activeId === c._id ? 'bg-brand-50 ring-brand-100 ring-1' : 'hover:bg-slate-50',
              )}
            >
              {c.type === 'class' ? (
                <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-white', tone(swatch, c.classroom?.color))}>
                  <Users className="size-[18px]" />
                </div>
              ) : (
                <Avatar name={c.title} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn('truncate text-sm', c.unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800')}>
                    {c.title}
                  </p>
                  {c.lastMessage?.at && <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(c.lastMessage.at)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('truncate text-xs', c.unread ? 'font-medium text-slate-700' : 'text-slate-500')}>
                    {c.lastMessage
                      ? `${c.type === 'class' ? `${firstName(c.lastMessage.senderName)}: ` : ''}${c.lastMessage.text}`
                      : c.type === 'class'
                        ? 'Class group'
                        : c.classroom?.courseCode || c.classroom?.title}
                  </p>
                  {c.unread > 0 && (
                    <span className="bg-brand-500 grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      <NewChatDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
};
