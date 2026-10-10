import { Router } from 'express';
import * as controller from './draws.controller.js';
import { requireRole } from '../../shared/middleware/auth.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

const router = Router();

router.get('/juego', controller.game);
router.get('/resumen', controller.summary);
router.get('/meses', controller.months);
router.get('/', controller.list);
router.get('/:id', controller.getById);

router.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN), controller.create);
router.delete('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN), controller.remove);

export default router;
