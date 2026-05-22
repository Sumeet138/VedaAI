# Backend Architecture
## VedaAI — Node.js + Express + TypeScript

**Version:** 1.0  
**Date:** 2026-05-22

---

## 1. Project Structure

```
backend/
├── package.json
├── tsconfig.json
├── railway.toml                    # Railway deployment config
├── .env.example
└── src/
    ├── index.ts                    # Entry: Express + Socket.io boot
    │
    ├── config/                     # Infrastructure setup (singleton exports)
    │   ├── env.ts                  # Zod env validation — app crashes if missing vars
    │   ├── mongo.ts                # Mongoose connect + disconnect
    │   └── redis.ts                # ioredis client singleton (shared by BullMQ + cache)
    │
    ├── middleware/                  # Express middleware
    │   ├── error.middleware.ts     # Global error handler (last middleware)
    │   ├── validate.middleware.ts  # Zod schema validation factory
    │   └── upload.middleware.ts    # Multer memoryStorage, PDF only, 10MB limit
    │
    ├── socket/
    │   └── socket.ts               # Socket.io server init, room join/leave handlers
    │
    ├── queue/
    │   ├── queues.ts               # BullMQ Queue instance ("ai-generation")
    │   ├── workers.ts              # BullMQ Worker instance (starts on boot)
    │   └── processors/
    │       └── generation.processor.ts   # Core job logic (7 steps)
    │
    ├── assignments/
    │   ├── assignment.model.ts     # Mongoose schema + model
    │   ├── assignment.routes.ts    # Express router
    │   ├── assignment.controller.ts
    │   ├── assignment.service.ts   # Business logic
    │   └── assignment.schema.ts    # Zod validation schemas
    │
    ├── papers/
    │   ├── paper.model.ts          # Mongoose schema + model
    │   ├── paper.routes.ts         # Express router
    │   ├── paper.controller.ts
    │   ├── paper.service.ts
    │   └── paper.schema.ts
    │
    └── shared/
        ├── logger.ts               # Winston logger (file + console)
        ├── cache.service.ts        # Redis get/set/del helpers
        ├── llm.service.ts          # Gemini API wrapper (parallel section calls)
        ├── pdf-extract.service.ts  # pdf-parse wrapper
        ├── latex.service.ts        # Build .tex string + compile via node-latex
        ├── prompt-builder.ts       # Build per-section prompt from assignment data
        └── paper-parser.ts         # Validate + transform Gemini JSON → QuestionPaper
```

---

## 2. Entry Point (`src/index.ts`)

Boot sequence:
```
1. Load + validate env vars (Zod — crashes if invalid)
2. Connect to MongoDB
3. Create Express app
4. Attach middleware (cors, json, upload)
5. Mount routes under /api/v1
6. Attach global error handler
7. Create HTTP server
8. Attach Socket.io to HTTP server
9. Start BullMQ worker
10. Listen on PORT
```

```typescript
// src/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { connectMongo } from './config/mongo';
import { initSocket } from './socket/socket';
import { startWorker } from './queue/workers';
import { assignmentRouter } from './assignments/assignment.routes';
import { paperRouter } from './papers/paper.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: env.CORS_ORIGIN } });

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.use('/api/v1/assignments', assignmentRouter);
app.use('/api/v1/papers', paperRouter);
app.get('/api/v1/health', (_, res) => res.json({ status: 'ok' }));

app.use(errorMiddleware);

initSocket(io);
startWorker(io);

connectMongo().then(() => {
  httpServer.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
  });
});
```

---

## 3. Config Layer

### `config/env.ts` — Zod-validated env
```typescript
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
  WORKER_CONCURRENCY: z.coerce.number().default(2),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  CORS_ORIGIN: z.string().url(),
});

export const env = schema.parse(process.env);
// If any var missing or invalid: throws at startup, app never boots
```

### `config/redis.ts` — Shared ioredis instance
```typescript
import Redis from 'ioredis';
import { env } from './env';

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,  // Required by BullMQ
});
```

---

## 4. Data Models

### Assignment Schema
```typescript
// assignments/assignment.model.ts
const AssignmentSchema = new Schema({
  title:                  { type: String, required: true },
  subject:                { type: String, required: true },
  gradeLevel:             { type: String, required: true },
  dueDate:                { type: Date, required: true },
  questionTypes:          [{ type: String, enum: QUESTION_TYPES }],
  totalQuestions:         { type: Number, required: true, min: 1 },
  totalMarks:             { type: Number, required: true, min: 1 },
  additionalInstructions: { type: String },
  extractedText:          { type: String },       // from pdf-parse
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  jobId:         { type: String },
  errorMessage:  { type: String },
  version:       { type: Number, default: 1 },    // increments on regenerate
}, { timestamps: true });
```

### QuestionPaper Schema
```typescript
// papers/paper.model.ts
const QuestionSchema = new Schema({
  id:         { type: String, required: true },   // UUID assigned post-parse
  number:     { type: Number, required: true },
  text:       { type: String, required: true },
  type:       { type: String, enum: QUESTION_TYPES },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
  marks:      { type: Number, required: true },
  options:    [String],                            // MCQ only
}, { _id: false });

const SectionSchema = new Schema({
  id:           { type: String, required: true },
  title:        { type: String, required: true },
  instruction:  { type: String, required: true },
  questionType: { type: String, enum: QUESTION_TYPES },
  totalMarks:   { type: Number, required: true },
  questions:    [QuestionSchema],
}, { _id: false });

const QuestionPaperSchema = new Schema({
  assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
  paperTitle:   { type: String, required: true },
  subject:      { type: String, required: true },
  gradeLevel:   { type: String, required: true },
  totalMarks:   { type: Number, required: true },
  duration:     { type: String },
  version:      { type: Number, default: 1 },
  sections:     [SectionSchema],
}, { timestamps: true });

// Index for fast lookup
QuestionPaperSchema.index({ assignmentId: 1, version: -1 });
```

---

## 5. API Routes

### Assignment Routes
```
POST   /api/v1/assignments              → create + queue job
GET    /api/v1/assignments              → list all (paginated)
GET    /api/v1/assignments/:id          → get single + status
DELETE /api/v1/assignments/:id          → delete assignment + paper
```

### Paper Routes
```
GET    /api/v1/papers/:assignmentId          → get latest paper (cache first)
POST   /api/v1/papers/:assignmentId/regenerate → re-queue generation
GET    /api/v1/papers/:assignmentId/export/pdf → stream PDF download
```

### Controller pattern (thin controllers, fat services)
```typescript
// assignments/assignment.controller.ts
export const createAssignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await assignmentService.create(req.body, req.file);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);  // global error handler catches
  }
};
```

---

## 6. BullMQ Worker — Generation Pipeline

### `queue/queues.ts`
```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const generationQueue = new Queue('ai-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});
```

### Job Payload
```typescript
interface GenerationJobData {
  assignmentId: string;
  version: number;
  assignmentData: {
    title: string;
    subject: string;
    gradeLevel: string;
    questionTypes: QuestionType[];
    totalQuestions: number;
    totalMarks: number;
    additionalInstructions?: string;
  };
  extractedText?: string;   // snapshot at queue time — no re-fetch race condition
}
```

### `queue/processors/generation.processor.ts` — 7 Steps
```typescript
export async function processGeneration(job: Job<GenerationJobData>, io: Server) {
  const { assignmentId, assignmentData, extractedText, version } = job.data;

  const emit = (status: JobProgressStatus, progress: number, message: string, extra = {}) => {
    io.to(assignmentId).emit(SOCKET_EVENTS.JOB_PROGRESS, {
      assignmentId, jobId: job.id, status, progress, message, ...extra,
    });
  };

  // Step 1 — queued
  emit('queued', 0, 'Job received, starting generation...');
  await Assignment.findByIdAndUpdate(assignmentId, { status: 'processing' });

  // Step 2 — extracting (text already in job data)
  emit('extracting', 10, 'Preparing content...');

  // Step 3 — build prompts (one per section)
  emit('prompting', 20, 'Building AI prompts...');

  // Step 4 — call Gemini in parallel (one call per question type)
  emit('generating', 30, `Generating ${assignmentData.questionTypes.length} sections in parallel...`);
  const sectionJsonStrings = await llmService.generateAllSections({
    questionTypes: assignmentData.questionTypes,
    totalQuestions: assignmentData.totalQuestions,
    totalMarks: assignmentData.totalMarks,
    assignmentData,
    extractedText,
  });
  // All sections done concurrently — ~2s regardless of section count
  emit('generating', 70, 'All sections generated, validating...');

  // Step 5 — parse + validate each section, assemble paper
  emit('parsing', 80, 'Validating structure...');
  const paperData = parseSections(sectionJsonStrings, assignmentData);  // throws PaperParseError if invalid

  // Step 6 — save
  emit('saving', 90, 'Saving question paper...');
  const paper = await paperService.upsert(assignmentId, paperData, version);
  await cacheService.set(`paper:${assignmentId}:v${version}`, paper, 3600);
  await Assignment.findByIdAndUpdate(assignmentId, { status: 'completed' });

  // Step 7 — done
  emit('completed', 100, 'Question paper ready!', { paperId: paper._id.toString() });
}
```

### Error handling in worker
```typescript
// queue/workers.ts
worker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= job.opts.attempts!) {
    await Assignment.findByIdAndUpdate(job.data.assignmentId, {
      status: 'failed',
      errorMessage: err.message,
    });
    io.to(job.data.assignmentId).emit(SOCKET_EVENTS.JOB_FAILED, {
      assignmentId: job.data.assignmentId,
      error: 'Generation failed. Please try again.',
    });
  }
});
```

---

## 7. Socket.io Setup

```typescript
// socket/socket.ts
export function initSocket(io: Server) {
  io.on('connection', (socket) => {
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (assignmentId: string) => {
      socket.join(assignmentId);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (assignmentId: string) => {
      socket.leave(assignmentId);
    });
  });
}
```

Worker receives `io` instance (passed from `index.ts`) and calls `io.to(assignmentId).emit(...)`.

---

## 8. LLM Service — Gemini (Parallel Section Generation)

Each question type gets its own focused Gemini call, all fired concurrently via `Promise.all`. 3 types selected = 3 parallel calls (~2s) instead of one sequential call (~6s).

```typescript
// shared/llm.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import type { QuestionType } from '@vedaai/shared';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  systemInstruction: 'You are an expert educational assessment creator. Respond with ONLY valid JSON. No markdown, no explanation.',
});

interface SectionPromptParams {
  questionType: QuestionType;
  questionCount: number;
  marksPerSection: number;
  assignmentData: { title: string; subject: string; gradeLevel: string; additionalInstructions?: string };
  extractedText?: string;
  sectionLabel: string;  // "Section A", "Section B", etc.
}

// Single section generation
async function generateSection(params: SectionPromptParams): Promise<string> {
  const prompt = buildSectionPrompt(params);
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',  // Gemini JSON mode
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  });
  return result.response.text();
}

// All sections in parallel
export const llmService = {
  async generateAllSections(params: {
    questionTypes: QuestionType[];
    totalQuestions: number;
    totalMarks: number;
    assignmentData: SectionPromptParams['assignmentData'];
    extractedText?: string;
  }): Promise<string[]> {
    const sectionLabels = ['Section A', 'Section B', 'Section C', 'Section D', 'Section E'];
    const questionsPerSection = Math.ceil(params.totalQuestions / params.questionTypes.length);
    const marksPerSection = Math.ceil(params.totalMarks / params.questionTypes.length);

    const sectionPromises = params.questionTypes.map((type, i) =>
      generateSection({
        questionType: type,
        questionCount: questionsPerSection,
        marksPerSection,
        assignmentData: params.assignmentData,
        extractedText: params.extractedText,
        sectionLabel: sectionLabels[i],
      })
    );

    // All sections generated concurrently
    return Promise.all(sectionPromises);
  },
};
```

---

## 9. Paper Parser — Zod Firewall

```typescript
// shared/paper-parser.ts
import { z } from 'zod';
import { randomUUID } from 'crypto';

const QuestionSchema = z.object({
  number: z.number().int().positive(),
  text: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  marks: z.number().positive(),
  options: z.array(z.string()).optional(),
});

const SectionSchema = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
  questionType: z.enum(QUESTION_TYPES),
  totalMarks: z.number().positive(),
  questions: z.array(QuestionSchema).min(1),
});

const PaperSchema = z.object({
  paperTitle: z.string().min(1),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  totalMarks: z.number().positive(),
  duration: z.string().optional(),
  sections: z.array(SectionSchema).min(1),
});

export function parsePaper(rawJson: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new PaperParseError('LLM returned non-JSON response');
  }

  const result = PaperSchema.safeParse(parsed);
  if (!result.success) {
    throw new PaperParseError(`Invalid paper structure: ${result.error.message}`);
  }

  // Assign UUIDs after validation — LLM doesn't generate IDs
  return {
    ...result.data,
    sections: result.data.sections.map(section => ({
      ...section,
      id: randomUUID(),
      questions: section.questions.map(q => ({ ...q, id: randomUUID() })),
    })),
  };
}
```

---

## 10. Cache Service

```typescript
// shared/cache.service.ts
export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const val = await redisConnection.get(key);
    return val ? JSON.parse(val) : null;
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await redisConnection.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },

  async del(key: string): Promise<void> {
    await redisConnection.del(key);
  },
};
```

Paper controller uses `paper:{assignmentId}:v{version}` — checks cache before hitting MongoDB.

---

## 11. Middleware

### Error middleware (global, last in chain)
```typescript
export function errorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error(err.message, { stack: err.stack, path: req.path });

  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
  }
  if (err instanceof PaperParseError) {
    return res.status(422).json({ success: false, error: err.message });
  }

  res.status(500).json({ success: false, error: 'Internal server error' });
}
```

### Upload middleware (Multer)
```typescript
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),           // no disk — Railway compatible
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  },
}).single('file');
```

---

## 12. LaTeX PDF Service

PDF generation is server-side. Frontend hits `GET /papers/:assignmentId/export/pdf`, backend compiles `.tex` → streams PDF.

```typescript
// shared/latex.service.ts
import latex from 'node-latex';
import { Readable } from 'stream';
import type { QuestionPaper } from '@vedaai/shared';

export function buildTexString(paper: QuestionPaper): string {
  const sectionLetters = ['A', 'B', 'C', 'D', 'E'];

  const sectionsTeX = paper.sections.map((section, i) => {
    const questionsTeX = section.questions.map(q => {
      const diffTag = `\\textbf{[${q.difficulty.toUpperCase()}]}`;
      const marksTag = `\\hfill\\textit{[${q.marks} mark${q.marks > 1 ? 's' : ''}]}`;

      const optionsTeX = q.options
        ? `\\begin{enumerate}[label=\\Alph*.]
${q.options.map(o => `  \\item ${escapeTex(o)}`).join('\n')}
\\end{enumerate}`
        : '';

      return `\\item ${escapeTex(q.text)} ${diffTag} ${marksTeX}
${optionsTeX}`;
    }).join('\n\n');

    return `\\section*{${section.title}}
\\textit{${escapeTex(section.instruction)}} \\hfill \\textbf{Total: ${section.totalMarks} marks}
\\begin{enumerate}
${questionsTeX}
\\end{enumerate}`;
  }).join('\n\n');

  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[margin=2.5cm]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{booktabs}
\\usepackage{array}
\\pagestyle{plain}

\\begin{document}

\\begin{center}
  {\\Large\\bfseries ${escapeTex(paper.paperTitle)}}\\\\[4pt]
  {\\large ${escapeTex(paper.subject)} — ${escapeTex(paper.gradeLevel)}}\\\\[2pt]
  {\\normalsize Total Marks: ${paper.totalMarks}${paper.duration ? ` \\quad Duration: ${paper.duration}` : ''}}
\\end{center}

\\vspace{8pt}
\\noindent
\\begin{tabular}{p{6cm} p{4cm} p{4cm}}
  Name: \\hrulefill & Roll No: \\hrulefill & Section: \\hrulefill
\\end{tabular}
\\vspace{12pt}

\\hrule
\\vspace{10pt}

${sectionsTeX}

\\end{document}`;
}

function escapeTex(str: string): string {
  return str
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\\/g, '\\textbackslash{}');
}

export function compileTex(texString: string): NodeJS.ReadableStream {
  const input = Readable.from([texString]);
  return latex(input, { errorLogs: '/tmp/latex-errors.log' });
}
```

Controller usage:
```typescript
// papers/paper.controller.ts
export const exportPDF = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paper = await paperService.getLatest(req.params.assignmentId);
    const tex = buildTexString(paper);
    const pdf = compileTex(tex);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${paper.paperTitle}.pdf"`);
    pdf.pipe(res);

    pdf.on('error', next);
  } catch (err) {
    next(err);
  }
};
```

---

## 13. Railway Deployment Config

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

```toml
# nixpacks.toml  ← installs pdflatex (texlive-base ~200MB, not full ~4GB)
[phases.setup]
nixPkgs = ["texlive.combined.scheme-basic"]
```

`scheme-basic` includes `pdflatex` + core packages (`geometry`, `enumitem`, `booktabs`) — sufficient for exam paper formatting, keeps Railway image lean.

`package.json` scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  }
}
```

---

## 13. Environment Variables

| Variable | Example | Required |
|----------|---------|----------|
| `PORT` | `4000` | No (default 4000) |
| `MONGODB_URI` | `mongodb://...` | Yes |
| `REDIS_URL` | `redis://...` | Yes |
| `GEMINI_API_KEY` | `AIza...` | Yes |
| `CORS_ORIGIN` | `https://vedaai.vercel.app` | Yes |
| `WORKER_CONCURRENCY` | `2` | No (default 2) |
| `MAX_FILE_SIZE_MB` | `10` | No (default 10) |

---

## 14. Document Map

| Document | Path | Status |
|---------|------|--------|
| Product Requirements | `Docs/prd.md` | Done |
| System Design | `Docs/system-design.md` | Done |
| Backend Architecture (this doc) | `Docs/backend.md` | Done |
| Frontend Architecture | `Docs/frontend.md` | Next |
| README | `README.md` | Pending |
