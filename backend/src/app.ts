import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { assignmentRouter } from './assignments/assignment.routes';
import { paperRouter } from './papers/paper.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rate-limit.middleware';
import { requireApiKey } from './middleware/auth.middleware';

export function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());
  app.use('/api/v1', generalLimiter);
  app.use('/api/v1', requireApiKey);

  // Colorful request logger — dev only (prod log aggregators strip ANSI and this is noisy)
  if (env.NODE_ENV !== 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const ms = Date.now() - start;
        const color =
          res.statusCode >= 500 ? '\x1b[31m' :
          res.statusCode >= 400 ? '\x1b[33m' :
          res.statusCode >= 300 ? '\x1b[36m' : '\x1b[32m';
        console.log(`${color}${req.method}\x1b[0m ${req.originalUrl} ${color}${res.statusCode}\x1b[0m ${ms}ms`);
      });
      next();
    });
  }

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', env: env.NODE_ENV });
  });

  app.use('/api/v1/assignments', assignmentRouter);
  app.use('/api/v1/papers', paperRouter);

  app.use(errorMiddleware);

  return app;
}
