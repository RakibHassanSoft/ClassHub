import { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode = 500;
  let message = 'Something went wrong';
  let errors: { path: string; message: string }[] | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    errors = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    message = errors[0]?.message ?? 'Invalid input';
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    errors = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    message = errors[0]?.message ?? 'Invalid input';
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}`;
  } else if (err?.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'value';
    message = `This ${field} is already in use`;
  } else if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${env.maxUploadMb} MB)` : err.message;
  } else if (err?.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON body';
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(env.isProd || statusCode < 500 ? {} : { stack: err?.stack }),
  });
};
