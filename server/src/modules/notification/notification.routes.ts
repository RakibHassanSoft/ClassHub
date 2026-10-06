import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { NotificationService } from './notification.service';

const router = Router();
router.use(auth());

router.post(
  '/:id/read',
  catchAsync(async (req, res) => {
    await NotificationService.markRead(req.user!._id, String(req.params.id));
    sendResponse(res, { message: 'Marked as read' });
  }),
);

export const NotificationRoutes = router;
