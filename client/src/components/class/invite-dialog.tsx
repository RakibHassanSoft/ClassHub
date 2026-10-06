'use client';
/* eslint-disable @next/next/no-img-element -- QR codes are generated data URLs, next/image adds nothing */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useIsClient } from '@/hooks/use-is-client';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2, Maximize2, RefreshCw, Share2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/misc';
import { errorMessage, patch, post } from '@/lib/api';
import { qk } from '@/hooks/queries';
import type { Classroom } from '@/lib/types';

export const InviteDialog = ({ open, onClose, classroom }: { open: boolean; onClose: () => void; classroom: Classroom }) => {
  const qc = useQueryClient();
  const isClient = useIsClient();
  const origin = isClient ? window.location.origin : '';
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = `${origin}/join/${classroom.joinCode}`;
  const [qr, setQr] = useState('');
  const [big, setBig] = useState(false);

  useEffect(() => {
    if (!open || !origin) return;
    QRCode.toDataURL(link, { margin: 1, width: 520, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [open, origin, link]);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Invite link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    try {
      await navigator.share({
        title: `Join ${classroom.title} on ClassHub`,
        text: `Join ${classroom.courseCode || classroom.title} on ClassHub. Class code: ${classroom.joinCode}`,
        url: link,
      });
    } catch {
      /* user cancelled */
    }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: qk.class(classroom._id) });

  const toggle = async (joinEnabled: boolean) => {
    setBusy(true);
    try {
      await patch(`/classes/${classroom._id}`, { joinEnabled });
      await refresh();
      toast.success(joinEnabled ? 'Joining is on' : 'Joining is paused');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await post(`/classes/${classroom._id}/join-code/reset`);
      await refresh();
      toast.success('New link created. The old link no longer works.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite students"
      description="Students tap Join a class, then type this code or scan the QR. Their register ID is checked automatically."
      icon={<Link2 />}
    >
      <div className="space-y-5">
        <div className="from-brand-50 ring-brand-100 flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br to-teal-50 p-5 text-center ring-1 sm:flex-row sm:text-left">
          {qr && (
            <img src={qr} alt="QR code to join this class" className="size-32 shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-brand-700 text-xs font-bold tracking-wider uppercase">Class code</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-[0.2em] text-slate-900">{classroom.joinCode}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setBig(true)}>
              <Maximize2 /> Show on projector
            </Button>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-800 ring-1 ring-emerald-100">
          <ShieldCheck className="mt-px size-4 shrink-0" />
          Only students whose register ID is on your Students list can join with this code.
        </p>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pl-3.5">
          <p className="min-w-0 flex-1 truncate font-mono text-sm text-slate-600">{link}</p>
          <Button size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <Button variant="outline" className="w-full" onClick={share}>
            <Share2 /> Share via WhatsApp, Messenger…
          </Button>
        )}

        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Allow joining</p>
              <p className="text-xs text-slate-500">Turn off once everyone has joined.</p>
            </div>
            <Switch checked={classroom.joinEnabled} onChange={toggle} disabled={busy} label="Allow joining" />
          </div>
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Reset link</p>
              <p className="text-xs text-slate-500">Creates a new code; the old link stops working.</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset} loading={busy}>
              <RefreshCw /> Reset
            </Button>
          </div>
        </div>
      </div>
      <Dialog open={big} onClose={() => setBig(false)} size="xl" title={`Join ${classroom.courseCode || classroom.title}`}>
        <div className="flex flex-col items-center gap-6 py-4 text-center md:flex-row md:justify-center md:gap-12 md:text-left">
          {qr && <img src={qr} alt="QR code to join this class" className="size-72 rounded-2xl ring-1 ring-slate-200" />}
          <div>
            <p className="text-sm font-semibold text-slate-500">Open ClassHub → Join a class, then enter</p>
            <p className="mt-2 font-mono text-6xl font-extrabold tracking-[0.2em] text-slate-900 sm:text-7xl">{classroom.joinCode}</p>
            <p className="mt-4 text-sm text-slate-500">or scan the QR code with your phone camera</p>
          </div>
        </div>
      </Dialog>
    </Dialog>
  );
};
