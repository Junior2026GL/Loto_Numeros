import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import drawsRoutes from '../modules/draws/draws.routes.js';
import syncRoutes from '../modules/sync/sync.routes.js';
import statsRoutes from '../modules/stats/stats.routes.js';
import combosRoutes from '../modules/combos/combos.routes.js';
import * as authController from '../modules/auth/auth.controller.js';
import { authRequired, requirePasswordChanged } from '../shared/middleware/auth.middleware.js';
import { db } from '../infrastructure/database/mysql.js';

const router = Router();

// Para monitoreo: 200 si la API y la base de datos responden, 503 si la base no responde.
router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, service: 'Loto Números API', db: 'ok' });
  } catch {
    res.status(503).json({ ok: false, service: 'Loto Números API', db: 'error' });
  }
});

router.use('/auth', authRoutes);

router.use(authRequired);
// Estas dos rutas funcionan aunque el usuario deba cambiar su contraseña.
router.get('/auth/me', authController.me);
router.put('/auth/password', authController.changePassword);

router.use(requirePasswordChanged);
router.use('/users', usersRoutes);
router.use('/auditoria', auditRoutes);
router.use('/sorteos', drawsRoutes);
router.use('/sincronizacion', syncRoutes);
router.use('/estadisticas', statsRoutes);
router.use('/combinaciones', combosRoutes);

export default router;
