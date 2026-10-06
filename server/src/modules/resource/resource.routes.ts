import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { classAccess } from '../class/class.access';
import { ResourceController } from './resource.controller';
import { createResourceSchema, updateResourceSchema } from './resource.validation';

// mounted at /classes/:classId/resources
const router = Router({ mergeParams: true });
router.use(auth());
router.get('/', classAccess('member'), ResourceController.list);
router.post('/', classAccess('teacher'), validate(createResourceSchema), ResourceController.create);
router.patch('/:resourceId', classAccess('teacher'), validate(updateResourceSchema), ResourceController.update);
router.delete('/:resourceId', classAccess('teacher'), ResourceController.remove);

export const ResourceRoutes = router;
