import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { TEACHER_STATUSES } from '../user/user.model';
import { AdminService } from './admin.service';

const listSchema = z.object({
  role: z.enum(['teacher', 'student']).default('teacher'),
  status: z.enum(TEACHER_STATUSES).optional(),
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
const reviewSchema = z.object({ status: z.enum(['approved', 'rejected']), note: z.string().trim().max(300).optional() });
const activeSchema = z.object({ isActive: z.boolean() });

// everything here is for admins only
const router = Router();
router.use(auth('admin'));

router.get(
  '/stats',
  catchAsync(async (_req, res) => {
    sendResponse(res, { message: 'Stats', data: await AdminService.stats() });
  }),
);

router.get(
  '/users',
  validate(listSchema, 'query'),
  catchAsync(async (req, res) => {
    sendResponse(res, { message: 'Users', data: await AdminService.listUsers(req.query as unknown as z.infer<typeof listSchema>) });
  }),
);

router.patch(
  '/teachers/:id',
  validate(reviewSchema),
  catchAsync(async (req, res) => {
    const t = await AdminService.reviewTeacher(req.user!, String(req.params.id), req.body);
    sendResponse(res, { message: req.body.status === 'approved' ? 'Teacher approved' : 'Teacher rejected', data: t });
  }),
);

router.patch(
  '/users/:id/active',
  validate(activeSchema),
  catchAsync(async (req, res) => {
    const u = await AdminService.setActive(req.user!, String(req.params.id), req.body.isActive);
    sendResponse(res, { message: req.body.isActive ? 'Account enabled' : 'Account disabled', data: u });
  }),
);

export const AdminRoutes = router;
