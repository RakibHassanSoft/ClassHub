import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { classAccess } from '../class/class.access';
import { CLASSWORK_TYPES } from './classwork.model';
import { ClassworkService } from './classwork.service';
import { createClassworkSchema, gradeSchema, submitSchema, updateClassworkSchema } from './classwork.validation';

// mounted at /classes/:classId/classwork
const router = Router({ mergeParams: true });
router.use(auth());

router.get(
  '/',
  classAccess('member'),
  validate(z.object({ type: z.enum(CLASSWORK_TYPES).optional() }), 'query'),
  catchAsync(async (req, res) => {
    const { type } = req.query as { type?: string };
    sendResponse(res, {
      message: 'Classwork',
      data: await ClassworkService.list(req.classroom!, req.user!, req.membership!, type),
    });
  }),
);
router.post(
  '/',
  classAccess('teacher'),
  validate(createClassworkSchema),
  catchAsync(async (req, res) => {
    const data = await ClassworkService.create(req.classroom!, req.user!, req.body);
    sendResponse(res, { statusCode: 201, message: 'Posted to the class', data });
  }),
);
router.get(
  '/:workId',
  classAccess('member'),
  catchAsync(async (req, res) => {
    sendResponse(res, {
      message: 'Post',
      data: await ClassworkService.getOne(req.classroom!, req.user!, req.membership!, String(req.params.workId)),
    });
  }),
);
router.patch(
  '/:workId',
  classAccess('teacher'),
  validate(updateClassworkSchema),
  catchAsync(async (req, res) => {
    const data = await ClassworkService.update(req.classroom!, req.user!, String(req.params.workId), req.body);
    sendResponse(res, { message: 'Updated', data });
  }),
);
router.delete(
  '/:workId',
  classAccess('teacher'),
  catchAsync(async (req, res) => {
    await ClassworkService.remove(req.classroom!, req.user!, String(req.params.workId));
    sendResponse(res, { message: 'Deleted' });
  }),
);

// ---- homework submissions ----
router.post(
  '/:workId/submission',
  classAccess('member'),
  validate(submitSchema),
  catchAsync(async (req, res) => {
    const data = await ClassworkService.submit(
      req.classroom!,
      req.user!,
      req.membership!,
      String(req.params.workId),
      req.body,
    );
    sendResponse(res, { statusCode: 201, message: data.late ? 'Submitted (late)' : 'Submitted', data });
  }),
);
router.delete(
  '/:workId/submission',
  classAccess('member'),
  catchAsync(async (req, res) => {
    await ClassworkService.unsubmit(req.classroom!, req.user!, String(req.params.workId));
    sendResponse(res, { message: 'Submission removed' });
  }),
);
router.get(
  '/:workId/submissions',
  classAccess('teacher'),
  catchAsync(async (req, res) => {
    sendResponse(res, {
      message: 'Submissions',
      data: await ClassworkService.submissions(req.classroom!, String(req.params.workId)),
    });
  }),
);
router.patch(
  '/:workId/submissions/:submissionId',
  classAccess('teacher'),
  validate(gradeSchema),
  catchAsync(async (req, res) => {
    const data = await ClassworkService.grade(
      req.classroom!,
      String(req.params.workId),
      String(req.params.submissionId),
      req.body,
    );
    sendResponse(res, { message: 'Saved', data });
  }),
);

// mounted at /classwork
const mine = Router();
mine.get(
  '/upcoming',
  auth(),
  catchAsync(async (req, res) => {
    sendResponse(res, { message: 'Upcoming', data: await ClassworkService.upcoming(req.user!) });
  }),
);

export const ClassworkRoutes = router;
export const MyClassworkRoutes = mine;
