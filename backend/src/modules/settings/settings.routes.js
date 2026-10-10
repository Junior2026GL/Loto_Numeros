import { Router } from 'express';
import * as controller from './settings.controller.js';
import { requireRole } from '../../shared/middleware/auth.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

const router = Router();

router.use(requireRole(ROLES.SUPER_ADMIN));

router.get('/', controller.get);
router.put('/', controller.update);

export default router;
