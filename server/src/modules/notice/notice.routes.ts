import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { classAccess } from '../class/class.access';
import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';

/** Teachers, or class representatives (who cannot send urgent notices). */
const teacherOrCR = (req: Request, _res: Response, next: NextFunction) => {
  const m = req.membership!;
  if (m.role === 'teacher') return next();
  if (!m.isCR) return next(ApiError.forbidden('Only teachers and class representatives can post notices'));
  if (req.body?.type === 'urgent') return next(ApiError.forbidden('Only teachers can send urgent notices'));
  return next();
};
import { NoticeController } from './notice.controller';
import { createNoticeSchema, updateNoticeSchema } from './notice.validation';

// mounted at /classes/:classId/notices
const router = Router({ mergeParams: true });
router.use(auth());
router.get('/', classAccess('member'), NoticeController.list);
router.post('/', classAccess('member'), validate(createNoticeSchema), teacherOrCR, NoticeController.create);
router.patch('/:noticeId', classAccess('member'), validate(updateNoticeSchema), teacherOrCR, NoticeController.update);
router.delete('/:noticeId', classAccess('member'), teacherOrCR, NoticeController.remove);
router.post('/:noticeId/seen', classAccess('member'), NoticeController.seen);

// mounted at /notices
const feed = Router();
feed.get('/feed', auth(), NoticeController.feed);
feed.post('/feed/seen-all', auth(), NoticeController.seenAll);

export const NoticeRoutes = router;
export const NoticeFeedRoutes = feed;
