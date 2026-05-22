import { Schema, model } from 'mongoose';
import { QUESTION_TYPES } from '@vedaai/shared';

const QuestionSchema = new Schema(
  {
    id:         { type: String, required: true },
    number:     { type: Number, required: true },
    text:       { type: String, required: true },
    type:       { type: String, enum: QUESTION_TYPES },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    marks:      { type: Number, required: true },
    options:    [String],
    answer:     { type: String },
  },
  { _id: false },
);

const SectionSchema = new Schema(
  {
    id:           { type: String, required: true },
    title:        { type: String, required: true },
    instruction:  { type: String, required: true },
    questionType: { type: String, enum: QUESTION_TYPES },
    totalMarks:   { type: Number, required: true },
    questions:    [QuestionSchema],
  },
  { _id: false },
);

const QuestionPaperSchema = new Schema(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
    paperTitle:   { type: String, required: true },
    schoolName:   { type: String },
    subject:      { type: String, required: true },
    gradeLevel:   { type: String, required: true },
    totalMarks:   { type: Number, required: true },
    duration:     { type: String },
    instructions: [String],
    version:      { type: Number, default: 1 },
    sections:     [SectionSchema],
  },
  { timestamps: true },
);

QuestionPaperSchema.index({ assignmentId: 1, version: -1 });

export const QuestionPaperModel = model('QuestionPaper', QuestionPaperSchema);
