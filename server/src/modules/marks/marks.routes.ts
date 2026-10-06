import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { classAccess } from '../class/class.access';
import { MarksController } from './marks.controller';
import { createAssessmentSchema, saveScoresSchema, updateAssessmentSchema } from './marks.validation';

// mounted at /classes/:classId/marks
const router = Router({ mergeParams: true });
router.use(auth());
router.get('/me', classAccess('member'), MarksController.mine);
router.get('/', classAccess('teacher'), MarksController.sheet);
router.post('/', classAccess('teacher'), validate(createAssessmentSchema), MarksController.create);
router.patch('/:assessmentId', classAccess('teacher'), validate(updateAssessmentSchema), MarksController.update);
router.delete('/:assessmentId', classAccess('teacher'), MarksController.remove);
router.put('/:assessmentId/scores', classAccess('teacher'), validate(saveScoresSchema), MarksController.saveScores);

export const MarksRoutes = router;
