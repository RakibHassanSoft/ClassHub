'use client';

import { useState } from 'react';
import { BarChart3, Check, Lock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, post } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import type { ChatPoll } from '@/lib/types';

/** WhatsApp-style poll inside a chat bubble: tap an option to vote, see live results. */
export const PollCard = ({
  messageId,
  poll,
  meId,
  canClose,
  onChange,
}: {
  messageId: string;
  poll: ChatPoll;
  meId?: string;
  canClose: boolean;
  onChange: (poll: ChatPoll) => void;
}) => {
  const [busy, setBusy] = useState(false);
  const mine = new Set(poll.options.filter((o) => o.votes.includes(meId ?? '')).map((o) => o.id));
  const voters = new Set(poll.options.flatMap((o) => o.votes)).size;
  const top = Math.max(1, ...poll.options.map((o) => o.votes.length));

  const vote = async (id: string) => {
    if (poll.closed || busy) return;
    const next = new Set(poll.multiple ? mine : []);
    if (mine.has(id)) next.delete(id);
    else next.add(id);
    setBusy(true);
    try {
      const res = await post<ChatPoll>(`/chat/messages/${messageId}/vote`, { optionIds: [...next] });
      onChange(res.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    try {
      const res = await post<ChatPoll>(`/chat/messages/${messageId}/close-poll`);
      onChange(res.data);
      toast.success('Poll closed');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="w-64 max-w-full sm:w-72">
      <p className="flex items-start gap-2 text-[15px] leading-snug font-bold text-slate-900">
        <BarChart3 className="text-brand-600 mt-0.5 size-4 shrink-0" />
        {poll.question}
      </p>
      <p className="mt-0.5 mb-2 pl-6 text-[11px] text-slate-500">
        {poll.closed ? 'Poll closed' : poll.multiple ? 'Select one or more' : 'Select one'}
      </p>
      <div className="space-y-2">
        {poll.options.map((o) => {
          const chosen = mine.has(o.id);
          const pct = voters ? Math.round((o.votes.length / voters) * 100) : 0;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => vote(o.id)}
              disabled={poll.closed || busy}
              className="group block w-full cursor-pointer text-left disabled:cursor-default"
              aria-pressed={chosen}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center border-2 transition',
                    poll.multiple ? 'rounded-md' : 'rounded-full',
                    chosen ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white group-hover:border-brand-400',
                  )}
                >
                  {chosen && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-800">{o.text}</span>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">{o.votes.length}</span>
              </span>
              <span className="mt-1 ml-7.5 block h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                <span
                  className={cn('block h-full rounded-full transition-all', o.votes.length === top && voters ? 'bg-brand-500' : 'bg-brand-300')}
                  style={{ width: `${pct}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-black/[0.06] pt-2 text-xs">
        <span className="text-slate-500">
          {voters} {voters === 1 ? 'vote' : 'votes'}
        </span>
        {poll.closed ? (
          <span className="flex items-center gap-1 font-semibold text-slate-500">
            <Lock className="size-3" /> Closed
          </span>
        ) : (
          canClose && (
            <button type="button" onClick={close} className="cursor-pointer font-semibold text-rose-600 hover:underline">
              Close poll
            </button>
          )
        )}
      </div>
    </div>
  );
};

/** Dialog to create a poll (teachers and class representatives). */
export const PollDialog = ({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (poll: { question: string; options: string[]; multiple: boolean }) => Promise<boolean>;
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [saving, setSaving] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && filled.length >= 2;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      if (!(await onCreate({ question: question.trim(), options: filled, multiple }))) return;
      setQuestion('');
      setOptions(['', '']);
      setMultiple(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create poll"
      description="Everyone in the chat can vote. Results update live."
      icon={<BarChart3 />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>
            Send poll
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Question">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} placeholder="e.g. Which day suits you for the extra class?" />
        </Field>
        <Field label="Options">
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={o}
                  maxLength={120}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => setOptions((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && i === options.length - 1 && options.length < 10) {
                      e.preventDefault();
                      setOptions((list) => [...list, '']);
                    }
                  }}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions((list) => list.filter((_, j) => j !== i))}
                    className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove option"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <button
                type="button"
                onClick={() => setOptions((list) => [...list, ''])}
                className="text-brand-700 flex cursor-pointer items-center gap-1.5 text-sm font-semibold hover:underline"
              >
                <Plus className="size-4" /> Add option
              </button>
            )}
          </div>
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200">
          <span>
            <span className="block text-sm font-semibold text-slate-800">Allow multiple answers</span>
            <span className="block text-xs text-slate-500">People can pick more than one option</span>
          </span>
          <Switch checked={multiple} onChange={setMultiple} />
        </label>
      </div>
    </Dialog>
  );
};
