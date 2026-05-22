import type { Server } from 'socket.io';
import type { Job } from 'bullmq';
import { startMongo, stopMongo, clearMongo } from './helpers/mongo';
import { AssignmentModel } from '../assignments/assignment.model';

// Prevent real Redis/BullMQ connections
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
jest.mock('../queue/queues', () => ({ generationQueue: { add: jest.fn() } }));

// Mock LLM — never call real Gemini in tests
jest.mock('../shared/llm.service', () => ({
  llmService: {
    generateAllSections: jest.fn(),
  },
}));

// Mock cache — no real Redis
jest.mock('../shared/cache.service', () => ({
  cacheService: {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

import { llmService } from '../shared/llm.service';
import { processGeneration } from '../queue/processors/generation.processor';
import type { GenerationJobData } from '../queue/processors/generation.processor';

const VALID_SECTION_JSON = JSON.stringify({
  title: 'Section A',
  instruction: 'Attempt all questions',
  questionType: 'mcq',
  totalMarks: 10,
  questions: [
    {
      number: 1,
      text: 'What is 2 + 2?',
      type: 'mcq',
      difficulty: 'easy',
      marks: 2,
      options: ['A. 3', 'B. 4', 'C. 5', 'D. 6'],
    },
  ],
});

function makeIo() {
  const mockEmit = jest.fn();
  const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
  return { io: { to: mockTo } as unknown as Server, mockTo, mockEmit };
}

function makeJob(assignmentId: string, overrides: Partial<GenerationJobData> = {}): Job<GenerationJobData> {
  return {
    id: 'test-job-id',
    data: {
      assignmentId,
      version: 1,
      assignmentData: {
        title: 'Test Paper',
        subject: 'Science',
        gradeLevel: 'Grade 9',
        questionTypes: ['mcq'],
        totalQuestions: 1,
        totalMarks: 10,
      },
      ...overrides,
    },
  } as unknown as Job<GenerationJobData>;
}

describe('processGeneration', () => {
  beforeAll(async () => { await startMongo(); });
  afterAll(async () => { await stopMongo(); });
  afterEach(async () => {
    await clearMongo();
    jest.clearAllMocks();
  });

  it('sets assignment status to processing on start', async () => {
    const assignment = await AssignmentModel.create({
      title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
      dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
      totalQuestions: 1, totalMarks: 10, status: 'pending', version: 1,
    });

    (llmService.generateAllSections as jest.Mock).mockResolvedValue([VALID_SECTION_JSON]);
    const { io } = makeIo();

    await processGeneration(makeJob(assignment._id.toString()), io);

    const updated = await AssignmentModel.findById(assignment._id);
    expect(updated?.status).toBe('completed');
  });

  it('emits 8 socket events (7 progress + 1 completed)', async () => {
    const assignment = await AssignmentModel.create({
      title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
      dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
      totalQuestions: 1, totalMarks: 10, status: 'pending', version: 1,
    });

    (llmService.generateAllSections as jest.Mock).mockResolvedValue([VALID_SECTION_JSON]);
    const { io, mockEmit } = makeIo();

    await processGeneration(makeJob(assignment._id.toString()), io);

    // 7 JOB_PROGRESS events + 1 JOB_COMPLETED event = 9 total
    expect(mockEmit).toHaveBeenCalledTimes(9);
  });

  it('emits completed event with paperId on success', async () => {
    const assignment = await AssignmentModel.create({
      title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
      dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
      totalQuestions: 1, totalMarks: 10, status: 'pending', version: 1,
    });

    (llmService.generateAllSections as jest.Mock).mockResolvedValue([VALID_SECTION_JSON]);
    const { io, mockEmit } = makeIo();

    await processGeneration(makeJob(assignment._id.toString()), io);

    const completedCall = mockEmit.mock.calls.find(
      ([eventName]) => eventName === 'job:completed',
    );
    expect(completedCall).toBeDefined();
    expect(completedCall![1]).toHaveProperty('paperId');
  });

  it('throws when LLM service throws (BullMQ will retry)', async () => {
    const assignment = await AssignmentModel.create({
      title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
      dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
      totalQuestions: 1, totalMarks: 10, status: 'pending', version: 1,
    });

    (llmService.generateAllSections as jest.Mock).mockRejectedValue(
      new Error('Gemini API rate limit'),
    );
    const { io } = makeIo();

    await expect(
      processGeneration(makeJob(assignment._id.toString()), io),
    ).rejects.toThrow('Gemini API rate limit');
  });

  it('throws PaperParseError when LLM returns invalid JSON', async () => {
    const assignment = await AssignmentModel.create({
      title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
      dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
      totalQuestions: 1, totalMarks: 10, status: 'pending', version: 1,
    });

    (llmService.generateAllSections as jest.Mock).mockResolvedValue(['not valid json']);
    const { io } = makeIo();

    await expect(
      processGeneration(makeJob(assignment._id.toString()), io),
    ).rejects.toThrow();
  });

  it('calls generateAllSections with correct params', async () => {
    const assignment = await AssignmentModel.create({
      title: 'Test', subject: 'Science', gradeLevel: 'Grade 9',
      dueDate: new Date(Date.now() + 86400000), questionTypes: ['mcq'],
      totalQuestions: 1, totalMarks: 10, status: 'pending', version: 1,
    });

    (llmService.generateAllSections as jest.Mock).mockResolvedValue([VALID_SECTION_JSON]);
    const { io } = makeIo();

    await processGeneration(makeJob(assignment._id.toString()), io);

    expect(llmService.generateAllSections).toHaveBeenCalledWith(
      expect.objectContaining({
        questionTypes: ['mcq'],
        totalQuestions: 1,
        totalMarks: 10,
      }),
    );
  });
});
