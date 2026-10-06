import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { UserController } from './user.controller';
import { changePasswordSchema, updateProfileSchema } from './user.validation';

const router = Router();

router.get('/me', auth(), UserController.getMe);
router.patch('/me', auth(), validate(updateProfileSchema), UserController.updateMe);
router.patch('/me/password', auth(), validate(changePasswordSchema), UserController.changePassword);

export const UserRoutes = router;
