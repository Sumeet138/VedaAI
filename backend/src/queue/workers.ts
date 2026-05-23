import { Worker, UnrecoverableError } from 'bullmq';
import type { Server } from 'socket.io';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';
import { processGeneration } from './processors/generation.processor';
import { processPdfExport } from './processors/pdf.processor';
import { AssignmentModel } from '../assignments/assignment.model';
import { QuestionPaperModel } from '../papers/paper.model';
import { LlmQuotaExhaustedError } from '../shared/llm.service';
import { SOCKET_EVENTS } from '@vedaai/shared';
import { generationQueue } from './queues';

// Boot-time recovery: any assignment stuck in `processing` whose job is not
// still active or waiting in BullMQ is treated as orphaned (server crashed mid-job).
// Mark it failed so the UI stops showing the "Interrupted" placeholder forever.
async function recoverOrphanedJobs(io: Server): Promise<void> {
  const stuck = await AssignmentModel.find({ status: 'processing' }).select('_id jobId').lean();
  if (stuck.length === 0) return;
  console.log(`[worker] checking ${stuck.length} processing assignment(s) for orphans`);

  const liveJobStates = new Set(['active', 'waiting', 'delayed', 'paused', 'waiting-children']);
  const orphaned: string[] = [];

  for (const a of stuck) {
    const assignmentId = String(a._id);
    let isLive = false;
    if (a.jobId) {
      try {
        const job = await generationQueue.getJob(a.jobId);
        if (job) {
          const state = await job.getState();
          if (liveJobStates.has(state)) isLive = true;
        }
      } catch (e) {
        console.warn(`[worker] could not inspect job ${a.jobId}:`, e);
      }
    }
    if (!isLive) orphaned.push(assignmentId);
  }

  if (orphaned.length === 0) {
    console.log('[worker] no orphans found');
    return;
  }
  console.log(`[worker] marking ${orphaned.length} orphan(s) as failed:`, orphaned);

  await AssignmentModel.updateMany(
    { _id: { $in: orphaned }, status: 'processing' },
    {
      status: 'failed',
      errorMessage: 'Generation interrupted (server restarted mid-job). Retry to regenerate.',
    },
  );

  for (const assignmentId of orphaned) {
    io.to(assignmentId).emit(SOCKET_EVENTS.JOB_FAILED, {
      assignmentId,
      jobId: '',
      status: 'failed' as const,
      progress: 0,
      message: 'Generation interrupted (server restarted mid-job). Retry to regenerate.',
    });
  }
}

const devLog = env.NODE_ENV !== 'production' ? console.log.bind(console) : () => {};

export function startWorker(io: Server): { generationWorker: Worker; pdfWorker: Worker } {
  const generationWorker = new Worker(
    'ai-generation',
    async (job) => {
      devLog(`[worker] job ${job.id} starting for assignment ${job.data.assignmentId}`);
      try {
        await processGeneration(job, io);
        devLog(`[worker] job ${job.id} completed`);
      } catch (err) {
        console.error(`[worker] job ${job.id} threw:`, err);
        // Non-retryable: quota exhausted. Wrap in BullMQ's UnrecoverableError so it skips remaining attempts.
        if (err instanceof LlmQuotaExhaustedError) {
          throw new UnrecoverableError(err.message);
        }
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY,
      // Detect dead-worker jobs fast — default 30s + maxStalled=1 means a crashed
      // worker leaves the job hanging for ~30s before BullMQ retries it.
      stalledInterval: 15_000,
      maxStalledCount: 2,
    },
  );

  // Recover assignments that were mid-job when the server died.
  // Any row in `processing` with no live BullMQ job for it = orphan.
  recoverOrphanedJobs(io).catch((e) =>
    console.error('[worker] orphan recovery failed:', e),
  );

  generationWorker.on('failed', async (job, err) => {
    console.error(`[worker] failed event — job=${job?.id} attempt=${job?.attemptsMade}/${job?.opts.attempts ?? 1}:`, err?.message);
    if (err?.stack) console.error(err.stack);
    if (!job) return;
    // BullMQ stops retrying when the error is UnrecoverableError. attemptsMade
    // won't reach `attempts` in that case — so we must check the error name too.
    const attemptsExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    const nonRetryable = err?.name === 'UnrecoverableError';
    if (attemptsExhausted || nonRetryable) {
      // Paper may have been persisted before a downstream step (cache.set, socket emit) threw.
      // If a paper for the current version exists, the job effectively succeeded — don't mark failed.
      const { assignmentId, version } = job.data;
      const paper = await QuestionPaperModel.findOne({ assignmentId, version }).select('_id').lean();
      if (paper) {
        console.warn(`[worker] job ${job.id} threw but paper v${version} exists — marking completed`);
        await AssignmentModel.findByIdAndUpdate(assignmentId, { status: 'completed', errorMessage: null });
        io.to(assignmentId).emit(SOCKET_EVENTS.JOB_COMPLETED, {
          assignmentId,
          jobId: job.id!,
          status: 'completed' as const,
          progress: 100,
          message: 'Question paper ready!',
          paperId: String(paper._id),
        });
        return;
      }
      await AssignmentModel.findByIdAndUpdate(assignmentId, {
        status: 'failed',
        errorMessage: err.message,
      });
      io.to(assignmentId).emit(SOCKET_EVENTS.JOB_FAILED, {
        assignmentId,
        jobId: job.id,
        status: 'failed' as const,
        progress: 0,
        message: err.message || 'Generation failed after multiple attempts. Please try again.',
      });
    }
  });

  generationWorker.on('error', (err) => {
    console.error('[worker] error event:', err);
  });

  // PDF export worker — runs alongside generation worker on the same Redis.
  const pdfWorker = new Worker(
    'pdf-export',
    async (job) => {
      devLog(`[pdf-worker] job ${job.id} starting for assignment ${job.data.assignmentId}`);
      try {
        await processPdfExport(job, io);
        devLog(`[pdf-worker] job ${job.id} completed`);
      } catch (err) {
        console.error(`[pdf-worker] job ${job.id} threw:`, err);
        throw err;
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // Puppeteer is heavy; serialize for stability
    },
  );

  pdfWorker.on('failed', (job, err) => {
    const attemptsAllowed = job?.opts.attempts ?? 1;
    const attemptsExhausted = (job?.attemptsMade ?? 0) >= attemptsAllowed;
    const nonRetryable = err?.name === 'UnrecoverableError';
    console.error(`[pdf-worker] failed — job=${job?.id} attempt=${job?.attemptsMade}/${attemptsAllowed}:`, err?.message);
    if (job && (attemptsExhausted || nonRetryable)) {
      io.to(job.data.assignmentId).emit(SOCKET_EVENTS.PDF_FAILED, {
        assignmentId: job.data.assignmentId,
        error: err?.message || 'PDF export failed.',
      });
    }
  });

  pdfWorker.on('error', (err) => {
    console.error('[pdf-worker] error event:', err);
  });

  return { generationWorker, pdfWorker };
}
