import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { classAccess } from '../class/class.access';
import { AUDIT_ENTITIES } from './audit.model';
import { AuditService } from './audit.service';

const querySchema = z.object({
  entity: z.enum(AUDIT_ENTITIES).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

// mounted at /classes/:classId/audit
const router = Router({ mergeParams: true });

router.get(
  '/',
  auth(),
  classAccess('teacher'),
  validate(querySchema, 'query'),
  catchAsync(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof querySchema>;
    const data = await AuditService.list(req.classroom!._id, q);
    sendResponse(res, { message: 'Activity log', data });
  }),
);

export const AuditRoutes = router;
