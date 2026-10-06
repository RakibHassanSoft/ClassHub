'use client';

import axios, { AxiosError } from 'axios';
import { useAuth } from './auth-store';
import type { ApiEnvelope } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

export const api = axios.create({ baseURL: API_URL, timeout: 60_000 });

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && useAuth.getState().token) {
      useAuth.getState().logout();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const next = encodeURIComponent(window.location.pathname);
        // full reload on purpose: clears every cached query of the expired session
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/login?next=${next}`;
      }
    }
    return Promise.reject(error);
  },
);

/** Unwraps `{ success, message, data }` and returns data. */
export const get = async <T>(url: string, params?: Record<string, unknown>) => (await api.get<ApiEnvelope<T>>(url, { params })).data.data;
export const post = async <T>(url: string, body?: unknown) => (await api.post<ApiEnvelope<T>>(url, body)).data;
export const patch = async <T>(url: string, body?: unknown) => (await api.patch<ApiEnvelope<T>>(url, body)).data;
export const put = async <T>(url: string, body?: unknown) => (await api.put<ApiEnvelope<T>>(url, body)).data;
export const del = async <T>(url: string) => (await api.delete<ApiEnvelope<T>>(url)).data;

export const errorMessage = (err: unknown, fallback = 'Something went wrong') => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
    if (err.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};
