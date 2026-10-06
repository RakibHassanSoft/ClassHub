'use client';

import axios from 'axios';
import { patch } from './api';

/**
 * Attendance saved while offline waits here (in this browser) and is sent
 * automatically when the connection comes back.
 */
const KEY = 'classhub-pending-attendance';
const EVENT = 'classhub:pending-changed';

export interface PendingSave {
  id: string; // `${classId}:${sessionId}`
  classId: string;
  sessionId: string;
  label: string; // e.g. "CSE-221 · 5 Oct 2026"
  body: unknown;
  savedAt: string;
}

const read = (): PendingSave[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as PendingSave[];
  } catch {
    return [];
  }
};

const write = (items: PendingSave[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full or blocked: nothing else we can do */
  }
  window.dispatchEvent(new Event(EVENT));
};

export const pendingSaves = read;
export const onPendingChange = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
};

/** True when the request never reached the server (offline, DNS, server down). */
export const isNetworkError = (err: unknown) => axios.isAxiosError(err) && !err.response;

export const queueSave = (item: Omit<PendingSave, 'id' | 'savedAt'>) => {
  const id = `${item.classId}:${item.sessionId}`;
  write([...read().filter((p) => p.id !== id), { ...item, id, savedAt: new Date().toISOString() }]);
};

export const pendingFor = (classId: string, sessionId: string) => read().find((p) => p.id === `${classId}:${sessionId}`);

let flushing = false;
/** Sends everything waiting. Returns how many were synced and which failed for good. */
export const flushPending = async () => {
  if (flushing) return { synced: 0, failed: [] as string[] };
  flushing = true;
  let synced = 0;
  const failed: string[] = [];
  try {
    for (const item of read()) {
      try {
        await patch(`/classes/${item.classId}/attendance/${item.sessionId}`, item.body);
        synced += 1;
        write(read().filter((p) => p.id !== item.id));
      } catch (err) {
        if (isNetworkError(err)) break; // still offline: keep the rest for later
        failed.push(item.label);
        write(read().filter((p) => p.id !== item.id)); // rejected by server (e.g. sheet deleted)
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, failed };
};
