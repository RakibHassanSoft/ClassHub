import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { pushEnabled, PushService } from './push.service';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

const router = Router();

router.get(
  '/config',
  catchAsync(async (_req, res) => {
    sendResponse(res, {
      message: 'Push config',
      data: { enabled: pushEnabled(), publicKey: env.vapid.publicKey || null },
    });
  }),
);

router.post(
  '/subscribe',
  auth(),
  validate(subscriptionSchema),
  catchAsync(async (req, res) => {
    await PushService.subscribe(req.user!._id, req.body, req.headers['user-agent']);
    sendResponse(res, { statusCode: 201, message: 'Notifications turned on for this device' });
  }),
);

router.post(
  '/unsubscribe',
  auth(),
  validate(z.object({ endpoint: z.string().max(1000) })),
  catchAsync(async (req, res) => {
    await PushService.unsubscribe(req.user!._id, req.body.endpoint);
    sendResponse(res, { message: 'Notifications turned off for this device' });
  }),
);

router.post(
  '/test',
  auth(),
  catchAsync(async (req, res) => {
    const data = await PushService.sendToUsers([req.user!._id], {
      title: 'ClassHub notifications are on',
      body: 'You will get class updates on this device.',
      url: '/notifications',
      tag: 'test',
    });
    sendResponse(res, { message: data.sent ? 'Test notification sent' : 'No device is subscribed yet', data });
  }),
);

export const PushRoutes = router;
