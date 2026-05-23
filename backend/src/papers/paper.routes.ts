import { Router } from 'express';
import { paperController } from './paper.controller';
import {
  llmLimiter,
  llmHourlyLimiter,
  puppeteerLimiter,
  puppeteerHourlyLimiter,
} from '../middleware/rate-limit.middleware';

export const paperRouter = Router();

paperRouter.get('/:assignmentId', paperController.getLatest);
paperRouter.post(
  '/:assignmentId/regenerate',
  llmLimiter,
  llmHourlyLimiter,
  paperController.regenerate,
);

// Queued PDF export (preferred):
//   POST /:id/export/pdf            -> enqueue or return cached descriptor
//   GET  /:id/export/pdf/download   -> stream cached buffer (404 if not ready)
paperRouter.post(
  '/:assignmentId/export/pdf',
  puppeteerLimiter,
  puppeteerHourlyLimiter,
  paperController.requestPdfExport,
);
paperRouter.get('/:assignmentId/export/pdf/download', paperController.downloadPdf);

// Synchronous fallback (kept for backward compatibility / shareable links):
paperRouter.get(
  '/:assignmentId/export/pdf',
  puppeteerLimiter,
  puppeteerHourlyLimiter,
  paperController.exportPdf,
);
