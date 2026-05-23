import { Router } from 'express';
import { assignmentController } from './assignment.controller';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { llmLimiter, llmHourlyLimiter } from '../middleware/rate-limit.middleware';

export const assignmentRouter = Router();

assignmentRouter.post('/', uploadMiddleware, llmHourlyLimiter, assignmentController.create);
assignmentRouter.post(
  '/suggest-name',
  llmLimiter,
  llmHourlyLimiter,
  assignmentController.suggestName,
);
assignmentRouter.get('/', assignmentController.list);
assignmentRouter.get('/:id', assignmentController.getById);
assignmentRouter.delete('/:id', assignmentController.deleteById);
