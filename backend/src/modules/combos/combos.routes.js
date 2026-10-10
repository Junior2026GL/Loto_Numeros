import { Router } from 'express';
import * as controller from './combos.controller.js';

const router = Router();

// Rutas fijas primero: si no, "/:id" las confundiría con un identificador.
router.post('/generar', controller.generate);
router.post('/cobertura', controller.wheel);
router.post('/simular', controller.simulate);
router.get('/probabilidades', controller.odds);
router.get('/resumen', controller.summary);
router.get('/presupuesto', controller.budget);
router.put('/presupuesto', controller.setLimit);
router.get('/exportar', controller.exportCsv);
router.get('/prueba-retrospectiva', controller.retrospective);
router.get('/', controller.list);
router.post('/', controller.save);
router.patch('/:id/jugada', controller.setPlayed);
router.patch('/:id/premio', controller.setPrize);
router.delete('/:id', controller.remove);

export default router;
