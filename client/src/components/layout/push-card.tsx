'use client';

import { useEffect, useState } from 'react';
import { BellOff, BellRing, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage, post } from '@/lib/api';
import { currentSubscription, disablePush, enablePush, pushPermission, pushSupported } from '@/lib/push';
import { useIsClient } from '@/hooks/use-is-client';
import { cn } from '@/lib/utils';

type State = 'loading' | 'unsupported' | 'blocked' | 'off' | 'on';

const readState = async (): Promise<State> => {
  if (!pushSupported()) return 'unsupported';
  if (pushPermission() === 'denied') return 'blocked';
  return (await currentSubscription()) ? 'on' : 'off';
};

/** Turn phone / desktop notifications on or off for this device. */
export const PushCard = ({ compact }: { compact?: boolean }) => {
  const isClient = useIsClient();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isClient) return;
    let alive = true;
    readState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('off'));
    return () => {
      alive = false;
    };
  }, [isClient]);

  const turnOn = async () => {
    setBusy(true);
    try {
      await enablePush();
      setState('on');
      toast.success('Notifications are on for this device');
    } catch (err) {
      toast.error(errorMessage(err));
      setState(await readState());
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    try {
      await disablePush();
      setState('off');
      toast.success('Notifications turned off for this device');
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    try {
      const res = await post('/push/test');
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (compact) {
    if (state !== 'off' || dismissed) return null;
    return (
      <div className="border-brand-200 from-brand-50 flex flex-col gap-3 rounded-2xl border bg-gradient-to-r to-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="text-brand-600 shadow-soft grid size-10 shrink-0 place-items-center rounded-xl bg-white">
            <BellRing className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Get class updates on this device</p>
            <p className="text-xs text-slate-600">Cancelled classes, urgent notices and private messages — instantly.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Later
          </Button>
          <Button size="sm" onClick={turnOn} loading={busy}>
            Turn on
          </Button>
        </div>
      </div>
    );
  }

  const label: Record<State, string> = {
    loading: 'Checking…',
    unsupported:
      'This browser cannot show notifications. On iPhone, install the app first (Share → Add to Home Screen), then open it from the home screen.',
    blocked: 'Notifications are blocked for this site. Allow them in your browser’s site settings, then reload.',
    off: 'Notifications are off on this device.',
    on: 'Notifications are on for this device.',
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            state === 'on' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
          )}
        >
          {state === 'on' ? <BellRing className="size-5" /> : <BellOff className="size-5" />}
        </div>
        <p className="max-w-md text-sm text-slate-600">{label[state]}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {state === 'on' && (
          <>
            <Button size="sm" variant="outline" onClick={test}>
              <Send /> Test
            </Button>
            <Button size="sm" variant="ghost" onClick={turnOff} loading={busy}>
              Turn off
            </Button>
          </>
        )}
        {state === 'off' && (
          <Button size="sm" onClick={turnOn} loading={busy}>
            <BellRing /> Turn on
          </Button>
        )}
      </div>
    </div>
  );
};
