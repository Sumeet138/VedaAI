import { Request, Response, NextFunction } from 'express';
import { paperService } from './paper.service';
import { pdfService } from './pdf.service';
import { cacheService } from '../shared/cache.service';
import { pdfQueue } from '../queue/queues';
import { pdfCacheKey } from '../queue/processors/pdf.processor';
import { NotFoundError, BadRequestError } from '../shared/errors';

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'paper';
}

export const paperController = {
  async getLatest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paperService.getLatest(req.params.assignmentId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async regenerate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await paperService.regenerate(req.params.assignmentId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Synchronous PDF export — kept for backward compatibility & direct-link use.
   * Prefer the queued flow (POST /export/pdf + GET /export/pdf/download) for
   * production traffic so request workers aren't blocked on Puppeteer.
   */
  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignmentId } = req.params;
      const { paper, assignment } = (await paperService.getLatest(assignmentId)) as {
        paper: { paperTitle?: string };
        assignment: { version: number };
      };

      // Reuse cached PDF if a queued export already produced one
      const cacheKey = pdfCacheKey(assignmentId, assignment.version);
      let buffer = await cacheService.getBuffer(cacheKey);
      if (!buffer) {
        buffer = await pdfService.renderPaperPdf(assignmentId);
        await cacheService.setBuffer(cacheKey, buffer, 3600);
      }

      const filename = sanitizeFilename(paper.paperTitle ?? 'paper') + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Enqueue a background PDF export job. Returns immediately.
   * If a cached PDF already exists for this assignment+version, returns it directly.
   * Frontend should listen for SOCKET_EVENTS.PDF_READY then GET /download.
   */
  async requestPdfExport(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignmentId } = req.params;
      const { assignment } = (await paperService.getLatest(assignmentId)) as {
        assignment: { version: number };
      };

      const cacheKey = pdfCacheKey(assignmentId, assignment.version);
      const cached = await cacheService.exists(cacheKey);

      if (cached) {
        res.json({
          success: true,
          data: {
            status: 'ready',
            version: assignment.version,
            downloadPath: `/api/v1/papers/${assignmentId}/export/pdf/download?v=${assignment.version}`,
          },
        });
        return;
      }

      const job = await pdfQueue.add('export', {
        assignmentId,
        version: assignment.version,
      });

      res.status(202).json({
        success: true,
        data: {
          status: 'queued',
          jobId: job.id,
          version: assignment.version,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Stream the cached PDF buffer. 404 if not yet generated.
   */
  async downloadPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { assignmentId } = req.params;
      const versionParam = req.query.v;

      const { paper, assignment } = (await paperService.getLatest(assignmentId)) as {
        paper: { paperTitle?: string };
        assignment: { version: number };
      };

      const version = versionParam ? Number(versionParam) : assignment.version;
      if (Number.isNaN(version)) {
        throw new BadRequestError('Invalid version query param');
      }

      const buffer = await cacheService.getBuffer(pdfCacheKey(assignmentId, version));
      if (!buffer) {
        throw new NotFoundError('PDF not ready. Trigger generation via POST /export/pdf.');
      }

      const filename = sanitizeFilename(paper.paperTitle ?? 'paper') + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
