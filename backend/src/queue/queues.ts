import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const generationQueue = new Queue('ai-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const pdfQueue = new Queue('pdf-export', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

export interface PdfJobData {
  assignmentId: string;
  version: number;
}
