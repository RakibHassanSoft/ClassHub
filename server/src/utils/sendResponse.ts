import { Response } from 'express';

interface Payload<T> {
  statusCode?: number;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export const sendResponse = <T>(res: Response, payload: Payload<T>) => {
  const { statusCode = 200, message = 'OK', data, meta } = payload;
  res.status(statusCode).json({ success: true, message, data, meta });
};
