import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/** true in the browser after hydration, false during server render. */
export const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
