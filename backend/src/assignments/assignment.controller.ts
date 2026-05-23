import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { assignmentService } from './assignment.service';
import { createAssignmentSchema } from './assignment.schema';
import { groqService } from '../shared/groq.service';
import { QUESTION_TYPES } from '@vedaai/shared';

const suggestNameSchema = z.object({
  subject: z.string().min(1).max(100),
  gradeLevel: z.string().min(1).max(50),
  topic: z.string().max(200).optional(),
  questionTypes: z.array(z.enum(QUESTION_TYPES)).min(1),
});

export const assignmentController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createAssignmentSchema.parse(req.body);
      const result = await assignmentService.create(data, req.file);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await assignmentService.list();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await assignmentService.getById(req.params.id);
      res.json({ success: true, data: { assignment } });
    } catch (err) {
      next(err);
    }
  },

  async suggestName(req: Request, res: Response, next: NextFunction) {
    try {
      const data = suggestNameSchema.parse(req.body);
      const title = await groqService.suggestAssignmentName(data);
      res.json({ success: true, data: { title } });
    } catch (err) {
      next(err);
    }
  },

  async deleteById(req: Request, res: Response, next: NextFunction) {
    try {
      await assignmentService.deleteById(req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
