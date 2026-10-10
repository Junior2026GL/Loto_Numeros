import { Router } from 'express';
import * as controller from './audit.controller.js';
import { requireRole } from '../../shared/middleware/auth.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

const router = Router();

router.use(requireRole(ROLES.SUPER_ADMIN));

router.get('/resumen', controller.stats);
router.get('/', controller.list);

export default router;
