import request from 'supertest';
import { buildApp } from '../app';
import { startMongo, stopMongo, clearMongo } from './helpers/mongo';

// Mock ioredis — prevents real Redis connection attempts in tests
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

// Mock BullMQ queue — no real Redis needed in tests
jest.mock('../queue/queues', () => ({
  generationQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-123' }),
  },
}));

// Mock pdf-parse — avoid needing a real PDF binary
jest.mock('../shared/pdf-extract.service', () => ({
  extractTextFromBuffer: jest.fn().mockResolvedValue('Extracted PDF text content'),
}));

const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

const validFields = {
  title: 'Math Test Chapter 5',
  subject: 'Mathematics',
  gradeLevel: 'Grade 10',
  dueDate: tomorrow,
  questionTypes: JSON.stringify(['mcq', 'short_answer']),
  totalQuestions: '10',
  totalMarks: '50',
};

// Minimal valid PDF magic bytes for multer MIME check
const FAKE_PDF = Buffer.from('%PDF-1.4 fake content');

describe('Assignment API', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    await startMongo();
    app = buildApp();
  });

  afterAll(async () => {
    await stopMongo();
  });

  afterEach(async () => {
    await clearMongo();
    jest.clearAllMocks();
  });

  // ─── POST /api/v1/assignments ────────────────────────────────────────────

  describe('POST /api/v1/assignments', () => {
    it('creates assignment with valid payload and returns 201', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field(validFields);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignment._id).toBeDefined();
      expect(res.body.data.assignment.status).toBe('pending');
      expect(res.body.data.assignment.title).toBe('Math Test Chapter 5');
      expect(res.body.data.jobId).toBe('mock-job-123');
    });

    it('queues exactly one generation job after creation', async () => {
      const { generationQueue } = require('../queue/queues');
      await request(app).post('/api/v1/assignments').field(validFields);
      expect(generationQueue.add).toHaveBeenCalledTimes(1);
    });

    it('stores parsed questionTypes as array (not string)', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field(validFields);

      expect(Array.isArray(res.body.data.assignment.questionTypes)).toBe(true);
      expect(res.body.data.assignment.questionTypes).toContain('mcq');
    });

    it('accepts optional additionalInstructions', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field({ ...validFields, additionalInstructions: 'Focus on algebra' });

      expect(res.status).toBe(201);
      expect(res.body.data.assignment.additionalInstructions).toBe('Focus on algebra');
    });

    it('accepts optional PDF upload and stores extractedText', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field(validFields)
        .attach('file', FAKE_PDF, { filename: 'notes.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.data.assignment.extractedText).toBe('Extracted PDF text content');
    });

    it('returns 400 when title is missing', async () => {
      const { title: _omit, ...rest } = validFields;
      const res = await request(app).post('/api/v1/assignments').field(rest);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when subject is missing', async () => {
      const { subject: _omit, ...rest } = validFields;
      const res = await request(app).post('/api/v1/assignments').field(rest);
      expect(res.status).toBe(400);
    });

    it('returns 400 when questionTypes is empty array', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field({ ...validFields, questionTypes: JSON.stringify([]) });
      expect(res.status).toBe(400);
    });

    it('returns 400 when totalQuestions is 0', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field({ ...validFields, totalQuestions: '0' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when totalQuestions is negative', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field({ ...validFields, totalQuestions: '-5' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when totalMarks is 0', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field({ ...validFields, totalMarks: '0' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when dueDate is in the past', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field({ ...validFields, dueDate: '2020-01-01T00:00:00.000Z' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when questionType is invalid enum value', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .field({ ...validFields, questionTypes: JSON.stringify(['invalid_type']) });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/v1/assignments ─────────────────────────────────────────────

  describe('GET /api/v1/assignments', () => {
    it('returns empty list when no assignments exist', async () => {
      const res = await request(app).get('/api/v1/assignments');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignments).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });

    it('returns all assignments with correct count', async () => {
      await request(app).post('/api/v1/assignments').field(validFields);
      await request(app)
        .post('/api/v1/assignments')
        .field({ ...validFields, title: 'Science Test' });

      const res = await request(app).get('/api/v1/assignments');
      expect(res.status).toBe(200);
      expect(res.body.data.assignments).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
    });

    it('returns assignments sorted newest first', async () => {
      await request(app).post('/api/v1/assignments').field({ ...validFields, title: 'First' });
      await request(app).post('/api/v1/assignments').field({ ...validFields, title: 'Second' });

      const res = await request(app).get('/api/v1/assignments');
      expect(res.body.data.assignments[0].title).toBe('Second');
    });
  });

  // ─── GET /api/v1/assignments/:id ─────────────────────────────────────────

  describe('GET /api/v1/assignments/:id', () => {
    it('returns 404 for valid ObjectId that does not exist', async () => {
      const res = await request(app).get('/api/v1/assignments/507f1f77bcf86cd799439011');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for malformed ObjectId', async () => {
      const res = await request(app).get('/api/v1/assignments/not-a-valid-id');
      expect(res.status).toBe(400);
    });

    it('returns the correct assignment by id', async () => {
      const created = await request(app).post('/api/v1/assignments').field(validFields);
      const id = created.body.data.assignment._id;

      const res = await request(app).get(`/api/v1/assignments/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(id);
      expect(res.body.data.title).toBe('Math Test Chapter 5');
      expect(res.body.data.status).toBe('pending');
    });
  });

  // ─── DELETE /api/v1/assignments/:id ──────────────────────────────────────

  describe('DELETE /api/v1/assignments/:id', () => {
    it('returns 404 for non-existent id', async () => {
      const res = await request(app).delete('/api/v1/assignments/507f1f77bcf86cd799439011');
      expect(res.status).toBe(404);
    });

    it('deletes assignment and confirms it is gone', async () => {
      const created = await request(app).post('/api/v1/assignments').field(validFields);
      const id = created.body.data.assignment._id;

      const delRes = await request(app).delete(`/api/v1/assignments/${id}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const getRes = await request(app).get(`/api/v1/assignments/${id}`);
      expect(getRes.status).toBe(404);
    });
  });
});
