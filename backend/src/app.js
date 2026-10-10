import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './shared/middleware/error.middleware.js';
import { apiLimiter, loginLimiter } from './shared/middleware/rate-limit.middleware.js';

export const app = express();

app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
    // Permite al frontend leer el nombre del archivo en las descargas (Excel modelo).
    exposedHeaders: ['Content-Disposition'],
  })
);
// Esta API solo recibe JSON pequeño (el mayor es una lista de 6 números).
app.use(express.json({ limit: '100kb' }));

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);
