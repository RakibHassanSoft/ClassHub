'use client';

import { get, post } from './api';

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushPermission = (): NotificationPermission | 'unsupported' => (pushSupported() ? Notification.permission : 'unsupported');

const registration = async () => (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register('/sw.js');

export const currentSubscription = async () => {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
};

/** Asks permission, subscribes this device and saves it on the server. */
export const enablePush = async () => {
  if (!pushSupported())
    throw new Error('This browser does not support notifications. On iPhone, install the app first (Share → Add to Home Screen).');
  const config = await get<{ enabled: boolean; publicKey: string | null }>('/push/config');
  if (!config.enabled || !config.publicKey) throw new Error('Phone notifications are not set up on the server yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.publicKey) }));
  await post('/push/subscribe', sub.toJSON());
  return sub;
};

export const disablePush = async () => {
  const sub = await currentSubscription();
  if (!sub) return;
  await post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe();
};
