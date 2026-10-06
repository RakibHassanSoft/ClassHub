import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { classAccess } from '../class/class.access';
import { AttendanceController } from './attendance.controller';
import { createSessionSchema, updateSessionSchema } from './attendance.validation';
import { z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { CheckinService } from './attendance.checkin';

// slows down guessing of the 4-digit code
const checkinLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  keyGenerator: (req) => (req.user ? String(req.user._id) : ipKeyGenerator(req.ip ?? '')),
  message: { success: false, message: 'Too many tries. Wait a minute and use the code on the board.' },
});

// mounted at /classes/:classId/attendance
const router = Router({ mergeParams: true });

router.use(auth());

router.get('/me', classAccess('member'), AttendanceController.mine);
router.get('/analytics', classAccess('teacher'), AttendanceController.analytics);

// ---- self check-in ----
router.get(
  '/checkin/active',
  classAccess('member'),
  catchAsync(async (req, res) => {
    sendResponse(res, {
      message: 'Active check-in',
      data: await CheckinService.active(req.classroom!, req.membership!),
    });
  }),
);
router.get(
  '/:sessionId/checkin',
  classAccess('member'),
  catchAsync(async (req, res) => {
    const data = await CheckinService.status(
      req.classroom!,
      String(req.params.sessionId),
      req.membership!.role === 'teacher',
    );
    sendResponse(res, { message: 'Check-in status', data });
  }),
);
router.post(
  '/:sessionId/checkin/start',
  classAccess('teacher'),
  validate(z.object({ minutes: z.number().int().min(1).max(60).default(5) })),
  catchAsync(async (req, res) => {
    const data = await CheckinService.start(req.classroom!, req.user!, String(req.params.sessionId), req.body.minutes);
    sendResponse(res, { message: 'Check-in is open', data });
  }),
);
router.post(
  '/:sessionId/checkin/stop',
  classAccess('teacher'),
  catchAsync(async (req, res) => {
    sendResponse(res, {
      message: 'Check-in closed',
      data: await CheckinService.stop(req.classroom!, String(req.params.sessionId)),
    });
  }),
);
router.post(
  '/:sessionId/checkin',
  classAccess('member'),
  checkinLimiter,
  validate(
    z.object({
      code: z
        .string()
        .trim()
        .regex(/^\d{4}$/, 'Enter the 4-digit code'),
    }),
  ),
  catchAsync(async (req, res) => {
    const data = await CheckinService.checkIn(
      req.classroom!,
      req.membership!,
      req.user!,
      String(req.params.sessionId),
      req.body.code,
    );
    sendResponse(res, { message: data.alreadyCheckedIn ? 'You already checked in' : 'You are marked present', data });
  }),
);
router.get('/', classAccess('teacher'), AttendanceController.register);
router.post('/', classAccess('teacher'), validate(createSessionSchema), AttendanceController.create);
router.get('/:sessionId', classAccess('teacher'), AttendanceController.getOne);
router.patch('/:sessionId', classAccess('teacher'), validate(updateSessionSchema), AttendanceController.update);
router.delete('/:sessionId', classAccess('teacher'), AttendanceController.remove);

export const AttendanceRoutes = router;
