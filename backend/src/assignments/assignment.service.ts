import mongoose from 'mongoose';
import { AssignmentModel } from './assignment.model';
import { generationQueue } from '../queue/queues';
import { extractTextFromBuffer } from '../shared/pdf-extract.service';
import { NotFoundError, BadRequestError } from '../shared/errors';
import type { CreateAssignmentInput } from './assignment.schema';

export const assignmentService = {
  async create(data: CreateAssignmentInput, file?: Express.Multer.File) {
    let extractedText: string | undefined;

    if (file) {
      // Magic-byte check: real PDFs start with %PDF (25 50 44 46).
      // Multer's fileFilter only checks client-supplied mimetype — this validates the buffer.
      if (file.buffer.length < 4 || file.buffer.slice(0, 4).toString('ascii') !== '%PDF') {
        throw new BadRequestError('Uploaded file is not a valid PDF');
      }
      extractedText = await extractTextFromBuffer(file.buffer);
    }

    const assignment = await AssignmentModel.create({
      ...data,
      dueDate: new Date(data.dueDate),
      extractedText,
      status: 'pending',
    });

    const job = await generationQueue.add('generate', {
      assignmentId: assignment._id.toString(),
      version: 1,
      assignmentData: {
        title: data.title,
        subject: data.subject,
        gradeLevel: data.gradeLevel,
        topic: data.topic,
        questionTypes: data.questionTypes,
        totalQuestions: data.totalQuestions,
        totalMarks: data.totalMarks,
        additionalInstructions: data.additionalInstructions,
      },
      extractedText,
    });

    await AssignmentModel.findByIdAndUpdate(assignment._id, { jobId: job.id });

    return { assignment, jobId: job.id };
  },

  async list() {
    const assignments = await AssignmentModel.find().sort({ createdAt: -1 }).lean();
    return { assignments, total: assignments.length };
  },

  async getById(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestError('Invalid assignment ID format');
    }
    const assignment = await AssignmentModel.findById(id).lean();
    if (!assignment) throw new NotFoundError('Assignment not found');
    return assignment;
  },

  async deleteById(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestError('Invalid assignment ID format');
    }
    const assignment = await AssignmentModel.findByIdAndDelete(id);
    if (!assignment) throw new NotFoundError('Assignment not found');
    return { success: true };
  },
};
