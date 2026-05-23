import request from 'supertest';
import { buildApp } from '../app';
import { startMongo, stopMongo, clearMongo } from './helpers/mongo';
import { AssignmentModel } from '../assignments/assignment.model';
import { QuestionPaperModel } from '../papers/paper.model';

jest.mock('ioredis', () => {
  const EventEmitter = require('events');
  return class MockRedis extends EventEmitter {
    status = 'ready';
    connect() { return Promise.resolve(); }
    disconnect() { return Promise.resolve(); }
    get() { return Promise.resolve(null); }
    set() { return Promise.resolve('OK'); }
    del() { return Promise.resolve(1); }
  };
});
jest.mock('../queue/queues', () => ({
  generationQueue: { add: jest.fn().mockResolvedValue({ id: 'mock-job-456' }) },
}));
jest.mock('../shared/cache.service', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),    // cache miss by default
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

const SAMPLE_PAPER_DATA = {
  paperTitle: 'Science Test',
  subject: 'Science',
  gradeLevel: 'Grade 9',
  totalMarks: 10,
  version: 1,
  sections: [
    {
      id: 'section-uuid-1',
      title: 'Section A',
      instruction: 'Attempt all questions',
      questionType: 'mcq',
      totalMarks: 10,
      questions: [
        {
          id: 'question-uuid-1',
          number: 1,
          text: 'What is H2O?',
          type: 'mcq',
          difficulty: 'easy',
          marks: 2,
          options: ['A. Oxygen', 'B. Water', 'C. Hydrogen', 'D. Helium'],
        },
      ],
    },
  ],
};

describe('Paper API', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    await startMongo();
    app = buildApp();
  });
  afterAll(async () => { await stopMongo(); });
  afterEach(async () => {
    await clearMongo();
    jest.clearAllMocks();
  });

  // ─── GET /api/v1/papers/:assignmentId ────────────────────────────────────

  describe('GET /api/v1/papers/:assignmentId', () => {
    it('returns 404 when no paper exists for assignment', async () => {
      const assignment = await AssignmentModel.create({
        title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
        dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
        totalQuestions: 1, totalMarks: 10, status: 'completed', version: 1,
      });

      const res = await request(app).get(`/api/v1/papers/${assignment._id}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed assignment id', async () => {
      const res = await request(app).get('/api/v1/papers/bad-id');
      expect(res.status).toBe(400);
    });

    it('returns paper with assignment when both exist', async () => {
      const assignment = await AssignmentModel.create({
        title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
        dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
        totalQuestions: 1, totalMarks: 10, status: 'completed', version: 1,
      });

      await QuestionPaperModel.create({
        ...SAMPLE_PAPER_DATA,
        assignmentId: assignment._id,
      });

      const res = await request(app).get(`/api/v1/papers/${assignment._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paper.paperTitle).toBe('Science Test');
      expect(res.body.data.assignment._id.toString()).toBe(assignment._id.toString());
    });

    it('returns the latest version when multiple versions exist', async () => {
      const assignment = await AssignmentModel.create({
        title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
        dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
        totalQuestions: 1, totalMarks: 10, status: 'completed', version: 2,
      });

      await QuestionPaperModel.create({ ...SAMPLE_PAPER_DATA, assignmentId: assignment._id, version: 1 });
      await QuestionPaperModel.create({ ...SAMPLE_PAPER_DATA, assignmentId: assignment._id, version: 2, paperTitle: 'Science Test v2' });

      const res = await request(app).get(`/api/v1/papers/${assignment._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.paper.paperTitle).toBe('Science Test v2');
    });

    it('returns cached paper when cache hit', async () => {
      const { cacheService } = require('../shared/cache.service');
      const assignment = await AssignmentModel.create({
        title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
        dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
        totalQuestions: 1, totalMarks: 10, status: 'completed', version: 1,
      });

      const cachedPaper = { ...SAMPLE_PAPER_DATA, _id: 'cached-id', assignmentId: assignment._id.toString() };
      cacheService.get.mockResolvedValueOnce(cachedPaper);

      const res = await request(app).get(`/api/v1/papers/${assignment._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.paper._id).toBe('cached-id');
    });
  });

  // ─── POST /api/v1/papers/:assignmentId/regenerate ────────────────────────

  describe('POST /api/v1/papers/:assignmentId/regenerate', () => {
    it('returns 404 when assignment does not exist', async () => {
      const res = await request(app).post('/api/v1/papers/507f1f77bcf86cd799439011/regenerate');
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed assignment id', async () => {
      const res = await request(app).post('/api/v1/papers/bad-id/regenerate');
      expect(res.status).toBe(400);
    });

    it('queues a new generation job and increments version', async () => {
      const assignment = await AssignmentModel.create({
        title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
        dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
        totalQuestions: 1, totalMarks: 10, status: 'completed', version: 1,
      });

      const res = await request(app).post(`/api/v1/papers/${assignment._id}/regenerate`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe('mock-job-456');

      const updated = await AssignmentModel.findById(assignment._id);
      expect(updated?.version).toBe(2);
      expect(updated?.status).toBe('pending');
    });

    it('queues job with incremented version number', async () => {
      const { generationQueue } = require('../queue/queues');
      const assignment = await AssignmentModel.create({
        title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
        dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
        totalQuestions: 1, totalMarks: 10, status: 'completed', version: 1,
      });

      await request(app).post(`/api/v1/papers/${assignment._id}/regenerate`);

      expect(generationQueue.add).toHaveBeenCalledWith(
        'generate',
        expect.objectContaining({ version: 2 }),
      );
    });
  });
});
