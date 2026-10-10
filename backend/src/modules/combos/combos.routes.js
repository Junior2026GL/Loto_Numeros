import { Router } from 'express';
import * as controller from './combos.controller.js';

const router = Router();

router.post('/generar', controller.generate);
router.get('/resumen', controller.summary);
router.get('/exportar', controller.exportCsv);
router.get('/prueba-retrospectiva', controller.retrospective);
router.get('/', controller.list);
router.post('/', controller.save);
router.patch('/:id/jugada', controller.setPlayed);
router.delete('/:id', controller.remove);

export default router;
