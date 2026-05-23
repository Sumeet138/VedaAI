import { z } from 'zod';
import { QUESTION_TYPES } from '@vedaai/shared';

export const createAssignmentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  subject: z.string().min(2, 'Subject must be at least 2 characters').max(100),
  gradeLevel: z.string().min(1, 'Grade level is required'),
  topic: z.string().max(200).optional(),
  dueDate: z
    .string()
    .min(1, 'Due date is required')
    .refine((d) => new Date(d) > new Date(), 'Due date must be in the future'),
  questionTypes: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    },
    z
      .array(z.enum(QUESTION_TYPES))
      .min(1, 'At least one question type is required'),
  ),
  totalQuestions: z.coerce
    .number()
    .int()
    .min(1, 'Must have at least 1 question')
    .max(100),
  totalMarks: z.coerce
    .number()
    .int()
    .min(1, 'Total marks must be at least 1')
    .max(500),
  additionalInstructions: z.string().max(1000).optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
