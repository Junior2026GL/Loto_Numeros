import { Router } from 'express';
import * as controller from './users.controller.js';
import { requireRole } from '../../shared/middleware/auth.middleware.js';
import { ROLES } from '../../shared/constants/roles.js';

const router = Router();

router.use(requireRole(ROLES.SUPER_ADMIN));

router.get('/', controller.list);
router.get('/roles', controller.roles);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.patch('/:id/estado', controller.setActive);
router.patch('/:id/password', controller.resetPassword);

export default router;
