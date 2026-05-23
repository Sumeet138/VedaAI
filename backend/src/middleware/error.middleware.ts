import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    console.warn(`[400] ${req.method} ${req.originalUrl} — validation failed:`, err.flatten().fieldErrors);
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof AppError) {
    console.warn(`[${err.statusCode}] ${req.method} ${req.originalUrl} — ${err.message}`);
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[500] ${req.method} ${req.originalUrl} —`, err);
  } else {
    console.error(`[500] ${req.method} ${req.originalUrl} — ${err.message}`);
  }
  res.status(500).json({ success: false, error: 'Internal server error' });
}
