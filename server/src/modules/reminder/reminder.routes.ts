import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { classAccess } from '../class/class.access';
import { ReminderService } from './reminder.service';

const dayOffSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  slotId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  reason: z.string().trim().max(300).optional(),
  notify: z.boolean().optional(),
});

// mounted at /classes/:classId/reminders
const router = Router({ mergeParams: true });
router.use(auth());

router.get(
  '/',
  classAccess('member'),
  catchAsync(async (req, res) => {
    sendResponse(res, { message: 'Reminders', data: await ReminderService.overview(req.classroom!) });
  }),
);

router.post(
  '/test',
  classAccess('teacher'),
  catchAsync(async (req, res) => {
    const data = await ReminderService.sendTest(req.classroom!, req.user!);
    sendResponse(res, { message: data.push ? 'Test reminder sent to your devices' : 'Test reminder added to your notifications', data });
  }),
);

router.post(
  '/days-off',
  classAccess('teacher'),
  validate(dayOffSchema),
  catchAsync(async (req, res) => {
    const data = await ReminderService.addDayOff(req.classroom!, req.user!, req.body);
    sendResponse(res, { statusCode: 201, message: 'Class cancelled', data });
  }),
);

router.delete(
  '/days-off/:id',
  classAccess('teacher'),
  catchAsync(async (req, res) => {
    await ReminderService.removeDayOff(req.classroom!, String(req.params.id));
    sendResponse(res, { message: 'Class restored' });
  }),
);

export const ReminderRoutes = router;
