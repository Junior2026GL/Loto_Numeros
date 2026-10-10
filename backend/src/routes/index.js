import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import drawsRoutes from '../modules/draws/draws.routes.js';
import syncRoutes from '../modules/sync/sync.routes.js';
import statsRoutes from '../modules/stats/stats.routes.js';
import combosRoutes from '../modules/combos/combos.routes.js';
import * as authController from '../modules/auth/auth.controller.js';
import { authRequired } from '../shared/middleware/auth.middleware.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'Loto Números API' });
});

router.use('/auth', authRoutes);

router.use(authRequired);
router.get('/auth/me', authController.me);
router.put('/auth/password', authController.changePassword);
router.use('/users', usersRoutes);
router.use('/auditoria', auditRoutes);
router.use('/sorteos', drawsRoutes);
router.use('/sincronizacion', syncRoutes);
router.use('/estadisticas', statsRoutes);
router.use('/combinaciones', combosRoutes);

export default router;
