'use client';

import { useEffect, useState } from 'react';
import { useIsClient } from '@/hooks/use-is-client';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** "Install app" button: native prompt on Android/Chrome/Edge, instructions on iPhone. */
export const InstallButton = ({ variant = 'sidebar' }: { variant?: 'sidebar' | 'banner' }) => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const isClient = useIsClient();
  const [installedNow, setInstalled] = useState(false);
  const installed = !isClient || installedNow || isStandalone();
  const [iosHelp, setIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed || (!deferred && !isIos())) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } else {
      setIosHelp(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <div className="from-brand-600 shadow-brand relative overflow-hidden rounded-2xl bg-gradient-to-br to-teal-700 p-4 text-white">
          <div className="absolute -top-6 -right-6 size-24 rounded-full bg-white/10" />
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 cursor-pointer rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
          <p className="font-display text-sm font-bold">Get the app</p>
          <p className="mt-1 text-xs leading-relaxed text-white/80">Install ClassHub on your phone or computer for one-tap access.</p>
          <Button size="sm" variant="outline" className="text-brand-700 mt-3 w-full border-0" onClick={install}>
            <Download /> Install app
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="soft" onClick={install}>
          <Download /> Install
        </Button>
      )}

      <Dialog open={iosHelp} onClose={() => setIosHelp(false)} title="Install on iPhone" size="sm">
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="bg-brand-50 text-brand-700 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold">1</span>
            <span>
              Open this page in <b>Safari</b> and tap the <Share className="inline size-4 align-text-bottom" /> Share button.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-brand-50 text-brand-700 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold">2</span>
            <span>
              Scroll and tap <b>Add to Home Screen</b>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-brand-50 text-brand-700 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold">3</span>
            <span>
              Tap <b>Add</b>. ClassHub opens like a normal app.
            </span>
          </li>
        </ol>
      </Dialog>
    </>
  );
};
