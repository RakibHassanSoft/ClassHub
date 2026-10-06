'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CloudOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { flushPending, onPendingChange, pendingSaves } from '@/lib/offline-queue';
import { useIsClient } from '@/hooks/use-is-client';

/** Shows an offline bar and syncs attendance saved while offline once the connection returns. */
export const OfflineSync = () => {
  const isClient = useIsClient();
  const qc = useQueryClient();
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    if (!pendingSaves().length) return;
    setSyncing(true);
    const { synced, failed } = await flushPending();
    setSyncing(false);
    if (synced) {
      toast.success(`Synced ${synced} attendance sheet${synced > 1 ? 's' : ''} saved offline`);
      qc.invalidateQueries({ queryKey: ['class'] });
    }
    failed.forEach((label) => toast.error(`Could not sync ${label}. It may have been deleted.`));
  }, [qc]);

  useEffect(() => {
    if (!isClient) return undefined;
    const refresh = () => setCount(pendingSaves().length);
    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);
    const offPending = onPendingChange(refresh);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    queueMicrotask(() => {
      refresh();
      setOnline(navigator.onLine);
      if (navigator.onLine) sync();
    });
    return () => {
      offPending();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [isClient, sync]);

  if (online && !count) return null;

  return (
    <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
      <span className="inline-flex flex-wrap items-center justify-center gap-2">
        <CloudOff className="size-4" />
        {!online ? 'You are offline.' : ''}
        {count > 0 && ` ${count} attendance sheet${count > 1 ? 's are' : ' is'} saved on this device and will sync automatically.`}
        {online && count > 0 && (
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="inline-flex cursor-pointer items-center gap-1 font-semibold underline"
          >
            <RefreshCw className={syncing ? 'size-3.5 animate-spin' : 'size-3.5'} /> Sync now
          </button>
        )}
      </span>
    </div>
  );
};
