import { Router } from 'express';
import * as controller from './sync.controller.js';
import { requireRole } from '../../shared/middleware/auth.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

const router = Router();

router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get('/estado', controller.status);
router.get('/historial', controller.history);
router.post('/', controller.run);

export default router;
