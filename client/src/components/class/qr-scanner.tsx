'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff, Loader2 } from 'lucide-react';

/**
 * Live camera QR reader (works on Android + iPhone browsers over HTTPS or localhost).
 * Calls onResult once with the decoded text.
 */
export const QrScanner = ({ onResult }: { onResult: (text: string) => void }) => {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  const [state, setState] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;

    const tick = () => {
      if (!alive || done.current) return;
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        const w = v.videoWidth;
        const h = v.videoHeight;
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            done.current = true;
            navigator.vibrate?.(60);
            onResult(code.data);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use the camera. Type the class code instead.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!alive) return;
        const v = video.current!;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play();
        setState('scanning');
        raf = requestAnimationFrame(tick);
      } catch (err) {
        const name = (err as { name?: string }).name;
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, or type the class code.'
            : (err as Error).message || 'Could not open the camera. Type the class code instead.',
        );
        setState('error');
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
      <video ref={video} muted playsInline className="absolute inset-0 size-full object-cover" />
      <canvas ref={canvas} className="hidden" />
      {state === 'scanning' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative size-2/3 rounded-3xl ring-[999px] ring-slate-900/45">
            {[
              'top-0 left-0 border-t-4 border-l-4 rounded-tl-3xl',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-3xl',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-3xl',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-3xl',
            ].map((c) => (
              <span key={c} className={`border-brand-400 absolute size-10 ${c}`} />
            ))}
            <span className="bg-brand-400/80 absolute inset-x-4 top-1/2 h-0.5 animate-pulse" />
          </div>
        </div>
      )}
      {state === 'starting' && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Opening camera…
          </span>
        </div>
      )}
      {state === 'error' && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white">
          <div>
            <CameraOff className="mx-auto mb-3 size-8 text-white/70" />
            {error}
          </div>
        </div>
      )}
    </div>
  );
};

/** Pulls a class code out of a scanned value: a join link (…/join/AB3CD7E) or a bare code. */
export const extractJoinCode = (text: string) => {
  const trimmed = text.trim();
  const fromUrl = trimmed.match(/\/join\/([A-Za-z0-9-]+)/);
  const code = (fromUrl ? fromUrl[1] : trimmed).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length >= 5 && code.length <= 12 ? code : null;
};
