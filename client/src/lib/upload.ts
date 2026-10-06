'use client';

import { api } from './api';
import type { ApiEnvelope, UploadedFile } from './types';

export const MAX_UPLOAD_MB = 10;
export const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z,.jpg,.jpeg,.png,.webp,.gif';

/** Uploads one file (to Cloudinary or the server, decided by the API) and reports progress 0–100. */
export const uploadFile = async (file: File, classId: string | undefined, onProgress?: (pct: number) => void) => {
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`${file.name} is larger than ${MAX_UPLOAD_MB} MB`);
  const fd = new FormData();
  fd.append('file', file);
  if (classId) fd.append('classId', classId);
  const res = await api.post<ApiEnvelope<UploadedFile>>('/files', fd, {
    timeout: 5 * 60_000,
    onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
  });
  return res.data.data;
};

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
