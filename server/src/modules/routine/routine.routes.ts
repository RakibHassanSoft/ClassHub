import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { classAccess } from '../class/class.access';
import { RoutineController } from './routine.controller';
import { createSlotSchema, updateSlotSchema } from './routine.validation';

// mounted at /classes/:classId/routine
const router = Router({ mergeParams: true });
router.use(auth());
router.get('/', classAccess('member'), RoutineController.list);
router.post('/', classAccess('teacher'), validate(createSlotSchema), RoutineController.create);
router.patch('/:slotId', classAccess('teacher'), validate(updateSlotSchema), RoutineController.update);
router.delete('/:slotId', classAccess('teacher'), RoutineController.remove);

// mounted at /routine
const mine = Router();
mine.get('/me', auth(), RoutineController.myWeek);

export const RoutineRoutes = router;
export const MyRoutineRoutes = mine;
