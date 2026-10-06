'use client';
/* eslint-disable @next/next/no-img-element -- QR codes are generated data URLs, next/image adds nothing */

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Maximize2, Minimize2, QrCode, Square, Timer, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-store';
import { errorMessage, get, post } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { CheckinStatus } from '@/lib/types';

const useNow = (enabled: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return now;
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Teacher control for self check-in. Shows a rotating 4-digit code + QR on screen;
 * students type the code (or scan) and are marked present live.
 */
export const CheckinPanel = ({
  classId,
  sessionId,
  className,
  onCheckedIn,
}: {
  classId: string;
  sessionId: string;
  className: string;
  onCheckedIn: (entry: string) => void;
}) => {
  const qc = useQueryClient();
  const token = useAuth((s) => s.token);
  const key = ['checkin', classId, sessionId];
  const { data, dataUpdatedAt } = useQuery({
    queryKey: key,
    queryFn: () => get<CheckinStatus>(`/classes/${classId}/attendance/${sessionId}/checkin`),
    refetchInterval: (q) => (q.state.data?.open ? Math.max(2, Math.min(q.state.data.codeExpiresIn, 10)) * 1000 : false),
  });
  const [chooser, setChooser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);
  const [qr, setQr] = useState('');
  const now = useNow(Boolean(data?.open));

  const open = Boolean(data?.open && data.endsAt && new Date(data.endsAt).getTime() > now);

  useEffect(() => {
    if (!token) return undefined;
    const socket = getSocket(token);
    const onNew = (p: { sessionId: string; entry: string; name: string }) => {
      if (p.sessionId !== sessionId) return;
      onCheckedIn(p.entry);
      qc.invalidateQueries({ queryKey: key });
    };
    socket.on('checkin:new', onNew);
    return () => {
      socket.off('checkin:new', onNew);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionId, onCheckedIn]);

  useEffect(() => {
    if (!open || !data?.code) return;
    const url = `${window.location.origin}/checkin/${classId}/${sessionId}?code=${data.code}`;
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [open, data?.code, classId, sessionId]);

  const start = async (minutes: number) => {
    setBusy(true);
    try {
      await post(`/classes/${classId}/attendance/${sessionId}/checkin/start`, { minutes });
      setChooser(false);
      setBig(true);
      qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    setBusy(true);
    try {
      await post(`/classes/${classId}/attendance/${sessionId}/checkin/stop`);
      setBig(false);
      qc.invalidateQueries({ queryKey: key });
      toast.success('Check-in closed');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const checked = data?.checkedIn ?? [];
  const codeLeft = data ? Math.max(0, data.codeExpiresIn * 1000 - (now - dataUpdatedAt)) : 0;

  if (!open) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setChooser(true)}>
          <QrCode /> Self check-in
        </Button>
        <Dialog
          open={chooser}
          onClose={() => setChooser(false)}
          title="Let students check themselves in"
          description="A 4-digit code appears on your screen and changes every 30 seconds, so it only works for students in the room."
          icon={<QrCode />}
          size="sm"
        >
          <p className="mb-3 text-sm font-semibold text-slate-700">Keep check-in open for</p>
          <div className="grid grid-cols-4 gap-2">
            {[2, 5, 10, 15].map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => start(m)}
                className="font-display hover:border-brand-400 hover:bg-brand-50 cursor-pointer rounded-xl border border-slate-200 py-3 text-center text-lg font-bold text-slate-800 transition disabled:opacity-50"
              >
                {m}
                <span className="block text-[11px] font-medium text-slate-500">min</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Students who check in are marked Present. You can still change anyone before saving.
          </p>
        </Dialog>
      </>
    );
  }

  const panel = (
    <div className={cn('grid gap-6', big ? 'lg:grid-cols-[1fr_320px]' : 'md:grid-cols-[auto_1fr]')}>
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm font-semibold text-slate-500">
          Open <b className="text-slate-800">ClassHub → {className}</b> and enter
        </p>
        <p
          className={cn(
            'font-mono font-extrabold tracking-[0.25em] text-slate-900 tabular-nums',
            big ? 'text-7xl sm:text-8xl' : 'text-5xl',
          )}
        >
          {data?.code ?? '····'}
        </p>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-100">
          <div
            className="bg-brand-500 h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(0, Math.min(100, (codeLeft / ((data?.stepSeconds ?? 30) * 1000)) * 100))}%` }}
          />
        </div>
        {qr && <img src={qr} alt="QR code to check in" className={cn('rounded-xl ring-1 ring-slate-200', big ? 'size-64' : 'size-40')} />}
        <p className="text-xs text-slate-500">Or scan the QR code with the phone camera</p>
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <UserCheck className="text-brand-600 size-4" /> {checked.length} of {data?.total ?? 0} checked in
          </p>
          <p className="flex items-center gap-1 text-sm font-semibold text-slate-600 tabular-nums">
            <Timer className="size-4" /> {mmss(new Date(data!.endsAt!).getTime() - now)}
          </p>
        </div>
        <ul className={cn('scrollbar-thin space-y-1.5 overflow-y-auto', big ? 'max-h-[50vh]' : 'max-h-56')}>
          {checked.length === 0 && (
            <li className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Waiting for students…</li>
          )}
          {checked.map((c) => (
            <li
              key={c.entry}
              className="animate-pop-in flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm ring-1 ring-emerald-100"
            >
              <span className="truncate font-semibold text-emerald-900">{c.name}</span>
              <span className="ml-2 shrink-0 font-mono text-xs text-emerald-700">{c.studentId}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <div className="no-print border-brand-200 shadow-card rounded-2xl border bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display flex items-center gap-2 font-bold text-slate-900">
            <span className="relative flex size-2.5">
              <span className="bg-brand-400 absolute inline-flex size-full animate-ping rounded-full opacity-75" />
              <span className="bg-brand-500 relative inline-flex size-2.5 rounded-full" />
            </span>
            Self check-in is open
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBig(true)}>
              <Maximize2 /> Show on projector
            </Button>
            <Button size="sm" variant="danger" onClick={stop} loading={busy}>
              <Square /> Close check-in
            </Button>
          </div>
        </div>
        {big ? <p className="text-sm text-slate-500">The code is showing full screen. {checked.length} checked in so far.</p> : panel}
      </div>
      <Dialog open={big} onClose={() => setBig(false)} size="xl" title="Check in to class" icon={<QrCode />}>
        {panel}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setBig(false)}>
            <Minimize2 /> Smaller
          </Button>
          <Button variant="danger" onClick={stop} loading={busy}>
            <Square /> Close check-in
          </Button>
        </div>
      </Dialog>
    </>
  );
};
