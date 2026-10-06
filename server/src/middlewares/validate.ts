import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

type Source = 'body' | 'query' | 'params';

/** Validates and replaces req[source] with the parsed (typed, trimmed) value. */
export const validate =
  (schema: ZodType, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    if (source === 'body') req.body = result.data;
    else Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
