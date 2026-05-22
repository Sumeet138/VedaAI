import type { Job } from 'bullmq';
import type { Server } from 'socket.io';
import { AssignmentModel } from '../../assignments/assignment.model';
import { paperService } from '../../papers/paper.service';
import { llmService, planSections } from '../../shared/llm.service';
import { cacheService } from '../../shared/cache.service';
import { parseSections } from '../../shared/paper-parser';
import { SOCKET_EVENTS } from '@vedaai/shared';
import type { QuestionType, JobProgressStatus } from '@vedaai/shared';

export interface GenerationJobData {
  assignmentId: string;
  version: number;
  assignmentData: {
    title: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    questionTypes: QuestionType[];
    totalQuestions: number;
    totalMarks: number;
    additionalInstructions?: string;
  };
  extractedText?: string;
}

export async function processGeneration(
  job: Job<GenerationJobData>,
  io: Server,
): Promise<void> {
  const { assignmentId, assignmentData, extractedText, version } = job.data;

  const emit = (status: JobProgressStatus, progress: number, message: string, extra?: object) => {
    io.to(assignmentId).emit(SOCKET_EVENTS.JOB_PROGRESS, {
      assignmentId,
      jobId: job.id!,
      status,
      progress,
      message,
      ...extra,
    });
  };

  // Step 1 — queued
  emit('queued', 0, 'Job received, starting generation...');
  await AssignmentModel.findByIdAndUpdate(assignmentId, { status: 'processing' });

  // Step 2 — extracting
  emit('extracting', 10, 'Preparing content...');

  // Step 3 — prompting
  emit('prompting', 20, 'Building AI prompts...');

  // Step 4 — generate sections sequentially to avoid burst rate-limit exhaustion.
  // Progress crawls 30→70 as each section lands so the UI feels live, not stuck.
  const totalSections = assignmentData.questionTypes.length;
  emit('generating', 30, `Generating ${totalSections} section(s)...`);
  let sectionsDone = 0;
  const sectionJsonStrings = await llmService.generateAllSections({
    questionTypes: assignmentData.questionTypes,
    totalQuestions: assignmentData.totalQuestions,
    totalMarks: assignmentData.totalMarks,
    assignmentData,
    extractedText,
    onSectionComplete: ({ label, index, total }) => {
      sectionsDone += 1;
      const pct = 30 + Math.round((sectionsDone / total) * 40); // 30..70
      emit('generating', pct, `${label} ready (${sectionsDone}/${total})`, { sectionLabel: label, sectionIndex: index });
    },
  });
  emit('generating', 70, 'All sections generated, validating...');

  // Step 5 — parse & validate. Pass the same plan used to generate so the
  // parser can enforce exact question counts and per-question marks.
  emit('parsing', 80, 'Validating structure...');
  const { plan } = planSections({
    questionTypes: assignmentData.questionTypes,
    totalQuestions: assignmentData.totalQuestions,
    totalMarks: assignmentData.totalMarks,
    additionalInstructions: assignmentData.additionalInstructions,
  });
  const paperData = parseSections(
    sectionJsonStrings,
    {
      paperTitle: assignmentData.title,
      // schoolName omitted — frontend injects from teacher profile at render time
      subject: assignmentData.subject,
      gradeLevel: assignmentData.gradeLevel,
      totalMarks: assignmentData.totalMarks,
      duration: `${Math.ceil(assignmentData.totalQuestions * 1.5)} minutes`,
      instructions: [
        'All questions are compulsory unless stated otherwise.',
        'Write clearly and show all workings where applicable.',
        'Read each question carefully before answering.',
      ],
    },
    plan.map((p) => ({ count: p.count, marksEach: p.marksEach })),
  );

  // Step 6 — save
  emit('saving', 90, 'Saving question paper...');
  const paper = await paperService.upsert(assignmentId, paperData, version);
  await cacheService.set(`paper:${assignmentId}:v${version}`, paper, 3600);
  await AssignmentModel.findByIdAndUpdate(assignmentId, { status: 'completed' });

  // Step 7 — done (progress event)
  emit('completed', 100, 'Question paper ready!', { paperId: paper._id.toString() });

  // Emit the dedicated completed event so frontend can fetch
  io.to(assignmentId).emit(SOCKET_EVENTS.JOB_COMPLETED, {
    assignmentId,
    jobId: job.id!,
    status: 'completed' as const,
    progress: 100,
    message: 'Question paper ready!',
    paperId: paper._id.toString(),
  });
}
