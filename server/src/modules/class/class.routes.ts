import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { classAccess } from './class.access';
import { ClassController } from './class.controller';
import { cloneClassSchema, createClassSchema, updateClassSchema } from './class.validation';
import { z } from 'zod';

const router = Router();

router.use(auth());

router.post('/', auth('teacher'), validate(createClassSchema), ClassController.create);
router.get('/', ClassController.listMine);

router.get('/join/:code', ClassController.joinPreview);
router.post('/join/:code', ClassController.join);

router.get('/:classId', classAccess('member'), ClassController.getOne);
router.patch('/:classId', classAccess('teacher'), validate(updateClassSchema), ClassController.update);
router.delete('/:classId', classAccess('teacher'), ClassController.remove);
router.post('/:classId/join-code/reset', classAccess('teacher'), ClassController.resetJoinCode);
router.post('/:classId/leave', classAccess('member'), ClassController.leave);
router.post(
  '/:classId/clone',
  auth('teacher'),
  classAccess('teacher'),
  validate(cloneClassSchema),
  ClassController.clone,
);
router.get('/:classId/people', classAccess('member'), ClassController.people);
router.post(
  '/:classId/teachers',
  classAccess('teacher'),
  validate(z.object({ email: z.email('Enter a valid email') })),
  ClassController.addTeacher,
);
router.delete('/:classId/teachers/:userId', classAccess('teacher'), ClassController.removeTeacher);
router.patch(
  '/:classId/members/:userId',
  classAccess('teacher'),
  validate(z.object({ isCR: z.boolean() })),
  ClassController.setCR,
);

export const ClassRoutes = router;
