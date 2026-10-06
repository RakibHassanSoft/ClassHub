import { Router } from 'express';
import multer from 'multer';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../../config/env';
import { auth } from '../../middlewares/auth';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { cloudinaryEnabled } from '../../lib/storage';
import { FileService } from './file.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024, files: 1 },
});
const uploadLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 60,
  keyGenerator: (req) => (req.user ? String(req.user._id) : ipKeyGenerator(req.ip ?? '')),
  message: { success: false, message: 'Too many uploads. Please wait a few minutes.' },
});

const router = Router();

router.get(
  '/config',
  auth(),
  catchAsync(async (_req, res) => {
    sendResponse(res, {
      message: 'Upload config',
      data: { maxMb: env.maxUploadMb, provider: cloudinaryEnabled() ? 'cloudinary' : 'local' },
    });
  }),
);

router.post(
  '/',
  auth(),
  uploadLimiter,
  upload.single('file'),
  catchAsync(async (req, res) => {
    const data = await FileService.upload(req.user!, req.file, (req.body?.classId as string) || undefined);
    sendResponse(res, { statusCode: 201, message: 'Uploaded', data });
  }),
);

router.delete(
  '/:id',
  auth(),
  catchAsync(async (req, res) => {
    await FileService.remove(req.user!, String(req.params.id));
    sendResponse(res, { message: 'File deleted' });
  }),
);

export const FileRoutes = router;
