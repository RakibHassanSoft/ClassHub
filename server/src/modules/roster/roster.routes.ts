import { Router } from 'express';
import multer from 'multer';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { classAccess } from '../class/class.access';
import { RosterController } from './roster.controller';
import { addRosterSchema, bulkRosterSchema, updateRosterSchema } from './roster.validation';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// mounted at /classes/:classId/roster
const router = Router({ mergeParams: true });

router.use(auth(), classAccess('teacher'));

router.get('/', RosterController.list);
router.post('/', validate(addRosterSchema), RosterController.add);
router.post('/bulk', validate(bulkRosterSchema), RosterController.bulk);
router.post('/ai-extract', upload.single('file'), RosterController.aiExtract);
router.patch('/:entryId', validate(updateRosterSchema), RosterController.update);
router.delete('/:entryId', RosterController.remove);
router.post('/:entryId/unlink', RosterController.unlink);

export const RosterRoutes = router;
