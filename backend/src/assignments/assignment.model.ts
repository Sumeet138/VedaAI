import { Schema, model } from 'mongoose';
import { QUESTION_TYPES } from '@vedaai/shared';

const AssignmentSchema = new Schema(
  {
    title:                  { type: String, required: true },
    subject:                { type: String, required: true },
    gradeLevel:             { type: String, required: true },
    topic:                  { type: String },
    dueDate:                { type: Date, required: true },
    questionTypes:          [{ type: String, enum: QUESTION_TYPES }],
    totalQuestions:         { type: Number, required: true, min: 1 },
    totalMarks:             { type: Number, required: true, min: 1 },
    additionalInstructions: { type: String },
    extractedText:          { type: String },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    jobId:        { type: String },
    errorMessage: { type: String },
    version:      { type: Number, default: 1 },
  },
  { timestamps: true },
);

AssignmentSchema.index({ createdAt: -1 });
AssignmentSchema.index({ subject: 1, gradeLevel: 1, createdAt: -1 });
AssignmentSchema.index({ status: 1 });

export const AssignmentModel = model('Assignment', AssignmentSchema);
