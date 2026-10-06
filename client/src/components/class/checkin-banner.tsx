'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, get, post } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { ActiveCheckin } from '@/lib/types';

/** Student-side: appears in the class while the teacher has self check-in open. */
export const CheckinBanner = ({ classId }: { classId: string }) => {
  const qc = useQueryClient();
  const key = ['checkin-active', classId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => get<ActiveCheckin | null>(`/classes/${classId}/attendance/checkin/active`),
    refetchInterval: 20_000,
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!data) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data]);

  if (!data) return null;
  const left = new Date(data.endsAt).getTime() - now;
  if (left <= 0) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await post(`/classes/${classId}/attendance/${data.sessionId}/checkin`, { code });
      toast.success(res.message);
      setCode('');
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['class', classId, 'attendance', 'me'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const s = Math.round(left / 1000);
  const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (data.checkedIn) {
    return (
      <div className="no-print flex items-center gap-3 rounded-2xl bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
        <CheckCircle2 className="size-5" /> You are checked in for today&apos;s class.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="no-print animate-pop-in border-brand-200 from-brand-50 shadow-card flex flex-col gap-4 rounded-2xl border bg-gradient-to-r to-teal-50 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-display flex items-center gap-2 font-bold text-slate-900">
          <span className="relative flex size-2.5">
            <span className="bg-brand-400 absolute inline-flex size-full animate-ping rounded-full opacity-75" />
            <span className="bg-brand-500 relative inline-flex size-2.5 rounded-full" />
          </span>
          Attendance check-in is open
        </p>
        <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
          <Timer className="size-4" /> Closes in {clock} · enter the code shown in class
        </p>
      </div>
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="0000"
          aria-label="Check-in code"
          className="focus:border-brand-500 focus:ring-brand-500/15 h-12 w-32 rounded-xl border border-slate-200 bg-white text-center font-mono text-2xl font-bold tracking-[0.3em] text-slate-900 focus:ring-4 focus:outline-none"
        />
        <Button type="submit" size="lg" loading={busy} disabled={code.length !== 4}>
          Check in
        </Button>
      </div>
    </form>
  );
};
