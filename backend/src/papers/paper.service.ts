import mongoose from 'mongoose';
import { QuestionPaperModel } from './paper.model';
import { AssignmentModel } from '../assignments/assignment.model';
import { generationQueue } from '../queue/queues';
import { cacheService } from '../shared/cache.service';
import { NotFoundError, BadRequestError } from '../shared/errors';
import type { ParsedPaper } from '../shared/paper-parser';

export const paperService = {
  async upsert(assignmentId: string, data: ParsedPaper, version: number) {
    return QuestionPaperModel.findOneAndUpdate(
      { assignmentId: new mongoose.Types.ObjectId(assignmentId), version },
      { ...data, assignmentId: new mongoose.Types.ObjectId(assignmentId), version },
      { upsert: true, new: true },
    );
  },

  async getLatest(assignmentId: string) {
    if (!mongoose.isValidObjectId(assignmentId)) {
      throw new BadRequestError('Invalid assignment ID format');
    }

    // Check Redis cache first
    const assignment = await AssignmentModel.findById(assignmentId).lean();
    if (!assignment) throw new NotFoundError('Assignment not found');

    const cacheKey = `paper:${assignmentId}:v${assignment.version}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return { paper: cached, assignment };

    // Cache miss — hit MongoDB
    const paper = await QuestionPaperModel.findOne({ assignmentId })
      .sort({ version: -1 })
      .lean();
    if (!paper) throw new NotFoundError('No paper found for this assignment');

    // Populate cache for next request
    await cacheService.set(cacheKey, paper, 3600);
    return { paper, assignment };
  },

  async regenerate(assignmentId: string) {
    if (!mongoose.isValidObjectId(assignmentId)) {
      throw new BadRequestError('Invalid assignment ID format');
    }

    const assignment = await AssignmentModel.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment not found');

    const newVersion = assignment.version + 1;
    await AssignmentModel.findByIdAndUpdate(assignmentId, {
      version: newVersion,
      status: 'pending',
    });

    // Invalidate cached PDF — it's bound to the old version
    await cacheService.del(`pdf:${assignmentId}:v${assignment.version}`);

    const job = await generationQueue.add('generate', {
      assignmentId,
      version: newVersion,
      assignmentData: {
        title: assignment.title,
        subject: assignment.subject,
        gradeLevel: assignment.gradeLevel,
        questionTypes: assignment.questionTypes,
        totalQuestions: assignment.totalQuestions,
        totalMarks: assignment.totalMarks,
        additionalInstructions: assignment.additionalInstructions,
      },
      extractedText: assignment.extractedText,
    });

    return { jobId: job.id };
  },
};
