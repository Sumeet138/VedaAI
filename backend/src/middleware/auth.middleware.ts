import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.VEDA_API_KEY;

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    // No key configured — open access (dev mode without VEDA_API_KEY set)
    next();
    return;
  }
  const provided = req.headers['x-api-key'];
  if (provided === API_KEY) {
    next();
    return;
  }
  res.status(401).json({ success: false, error: 'Unauthorized' });
}
