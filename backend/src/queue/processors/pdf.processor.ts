import type { Job } from 'bullmq';
import type { Server } from 'socket.io';
import { pdfService } from '../../papers/pdf.service';
import { cacheService } from '../../shared/cache.service';
import { SOCKET_EVENTS } from '@vedaai/shared';
import type { PdfJobData } from '../queues';

const PDF_TTL_SECONDS = 3600;

export const pdfCacheKey = (assignmentId: string, version: number): string =>
  `pdf:${assignmentId}:v${version}`;

export async function processPdfExport(
  job: Job<PdfJobData>,
  io: Server,
): Promise<void> {
  const { assignmentId, version } = job.data;
  const key = pdfCacheKey(assignmentId, version);

  // Skip if already cached (another concurrent job won the race)
  if (await cacheService.exists(key)) {
    io.to(assignmentId).emit(SOCKET_EVENTS.PDF_READY, {
      assignmentId,
      version,
      downloadPath: `/api/v1/papers/${assignmentId}/export/pdf/download?v=${version}`,
      cached: true,
    });
    return;
  }

  const buffer = await pdfService.renderPaperPdf(assignmentId);
  await cacheService.setBuffer(key, buffer, PDF_TTL_SECONDS);

  io.to(assignmentId).emit(SOCKET_EVENTS.PDF_READY, {
    assignmentId,
    version,
    downloadPath: `/api/v1/papers/${assignmentId}/export/pdf/download?v=${version}`,
    cached: false,
  });
}
