import { Router } from 'express';
import * as controller from './auth.controller.js';
import { recoveryLimiter } from '../../shared/middleware/rate-limit.middleware.js';

const router = Router();

router.get('/opciones', controller.options);
router.post('/login', controller.login);
router.post('/forgot-password', recoveryLimiter, controller.forgotPassword);
router.post('/reset-password', recoveryLimiter, controller.resetPassword);

export default router;
