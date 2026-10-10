import { Router } from 'express';
import * as controller from './stats.controller.js';

const router = Router();

router.get('/', controller.getStats);

export default router;
