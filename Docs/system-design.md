# System Design
## VedaAI — AI Assessment Creator

**Version:** 1.0  
**Date:** 2026-05-22

---

## 1. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  BROWSER (Next.js 14)                                                │
│                                                                      │
│  /create page          /paper/[id] page       /assignments page     │
│  AssignmentForm ──────► GenerationProgress ──► PaperView            │
│       │                       ▲    ▲               ▲                │
│  Zustand Store           Socket.io  Polling      fetch paper        │
│  (assignment, paper,      events   fallback       on load           │
│   socket state)               │    │                                │
└───────────────────────────────┼────┼────────────────────────────────┘
                                │    │
          ┌─────────────────────┘    │ GET /assignments/:id (3s)
          │  Socket.io               │
          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND (Express + TypeScript, Railway)                            │
│                                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │  REST API   │    │  Socket.io   │    │   BullMQ Worker     │   │
│  │  /api/v1    │    │  Server      │    │   (generation)      │   │
│  │             │    │  room per    │    │                     │   │
│  │  POST /     │    │  assignmentId│    │  1. Build prompt    │   │
│  │  assignments│    │              │    │  2. Call Gemini     │   │
│  │  GET /      │──► │  Emit:       │◄───│  3. Parse JSON      │   │
│  │  papers/:id │    │  job:progress│    │  4. Save to MongoDB │   │
│  │  POST /     │    │  job:complete│    │  5. Cache in Redis  │   │
│  │  regenerate │    │  job:failed  │    │  6. Emit complete   │   │
│  └──────┬──────┘    └──────────────┘    └──────────┬──────────┘   │
│         │                                           │               │
│         │ add job                                   │ process job   │
│         ▼                                           ▼               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  BullMQ Queue ("ai-generation") — backed by Redis           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────┬───────────────────────────┘
               │                          │
    ┌──────────▼──────────┐    ┌──────────▼──────────┐
    │  MongoDB            │    │  Redis               │
    │  (Railway addon)    │    │  (Railway addon)     │
    │                     │    │                      │
    │  assignments        │    │  BullMQ job state    │
    │  question_papers    │    │  paper cache (1hr)   │
    └─────────────────────┘    └──────────────────────┘
                                          │
                               ┌──────────▼──────────┐
                               │  Google Gemini API   │
                               │  gemini-2.0-flash    │
                               │  JSON mode           │
                               └─────────────────────┘
```

---

## 2. Request Flow

### 2.1 Happy Path — Assignment Creation to Paper View

```
1. Teacher fills form → clicks "Generate"
2. Frontend: POST /api/v1/assignments (multipart/form-data)
   ├── Backend saves Assignment doc (status: 'pending')
   ├── If PDF uploaded: pdf-parse extracts text, saved to assignment.extractedText
   ├── BullMQ job added to "ai-generation" queue
   └── Response: { assignmentId, jobId }

3. Frontend:
   ├── Socket.io: join room `assignmentId`
   ├── Navigate to /paper/:assignmentId
   └── Start polling GET /assignments/:assignmentId every 3s (fallback)

4. BullMQ Worker picks up job:
   ├── Emit: { status: 'queued', progress: 0 }    → assignment status = 'processing'
   ├── Emit: { status: 'extracting', progress: 10 }
   ├── Emit: { status: 'prompting', progress: 20 }
   ├── Call Gemini API (JSON mode)
   ├── Emit: { status: 'generating', progress: 70 }
   ├── Zod-validate JSON → QuestionPaper shape
   ├── Emit: { status: 'parsing', progress: 80 }
   ├── Upsert QuestionPaper in MongoDB
   ├── Cache paper in Redis (key: paper:{assignmentId}:v{version}, TTL: 3600s)
   ├── Update Assignment status = 'completed'
   ├── Emit: { status: 'saving', progress: 90 }
   └── Emit: { status: 'completed', progress: 100, paperId }

5. Frontend receives 'completed' event (or polling detects status = 'completed'):
   ├── Hide progress overlay
   ├── Fetch GET /api/v1/papers/:assignmentId (hits Redis cache)
   └── Render PaperView
```

### 2.2 Failure Path

```
Worker fails (Gemini error / parse error):
├── BullMQ retries 3× with exponential backoff (5s, 25s, 125s)
├── After 3 failures: assignment status = 'failed', errorMessage set
└── Emit: { status: 'failed', error: 'human-readable message' }

Frontend:
└── Show error state with "Try Again" button (triggers regenerate)
```

### 2.3 Regenerate Flow

```
Teacher clicks "Regenerate":
1. POST /api/v1/papers/:assignmentId/regenerate
2. Backend: assignment.version++, status = 'pending'
3. New BullMQ job added
4. Frontend: re-join socket room, show progress overlay again
5. Worker produces new paper with incremented version
6. Old Redis cache invalidated (new key: paper:{id}:v{newVersion})
```

---

## 3. Realtime Strategy: Socket.io + Polling Hybrid

**Primary:** Socket.io events to browser room `assignmentId`  
**Fallback:** `GET /assignments/:id` polled every 3 seconds

**Why both:**
- Socket gives smooth real-time UX (animated progress bar)
- Polling handles: socket drop, browser tab restore, direct URL navigation
- Frontend stops polling as soon as socket `completed` event arrives (or polling detects `status === 'completed'`)

**Socket room lifecycle:**
```
Join room  → on form submit (after receiving assignmentId)
Leave room → on job:completed or job:failed event
```

---

## 4. Data Storage Strategy

### MongoDB — Source of truth
- `assignments` collection: full assignment data + current status
- `question_papers` collection: versioned paper results (never overwritten, new version doc on regenerate)

### Redis — Performance layer
- BullMQ job state (managed by BullMQ internally)
- Paper cache: `paper:{assignmentId}:v{version}` → JSON string, TTL 3600s
- Cache populated after each successful generation
- Cache miss: hit MongoDB, re-populate cache

### No file storage
- PDF uploads: extract text in-memory (Multer `memoryStorage`), store `extractedText` string in MongoDB
- No S3 / object storage needed for v1
- Keeps Railway deployment simple (no persistent disk required)

---

## 5. Shared Types Strategy

`shared/` npm workspace package — imported by both `frontend/` and `backend/`:

```
shared/src/
├── models/
│   ├── assignment.types.ts      ← Assignment, AssignmentStatus, QuestionType
│   ├── question-paper.types.ts  ← QuestionPaper, Section, Question, DifficultyLevel
│   └── socket.types.ts          ← JobProgressEvent, SOCKET_EVENTS constants
└── api/
    ├── request.types.ts         ← CreateAssignmentRequest, RegeneratePaperRequest
    └── response.types.ts        ← ApiResponse<T>, CreateAssignmentResponse, etc.
```

Single source of truth — type drift between frontend and backend eliminated.

---

## 6. Security Considerations

- Gemini response **never** rendered raw — always Zod-validated first
- File uploads: MIME type check (`application/pdf` only), 10MB limit
- Env vars: never committed, validated at startup with Zod (app refuses to start if missing)
- CORS: explicit `CORS_ORIGIN` env var, not wildcard

---

## 7. Deployment Architecture

```
GitHub Repo
├── /frontend ──► Vercel (auto-deploy on push to main)
└── /backend  ──► Railway service
                  ├── MongoDB addon (Railway-managed)
                  └── Redis addon (Railway-managed)
```

**Environment variable flow:**
- Railway backend → `MONGODB_URI`, `REDIS_URL`, `GEMINI_API_KEY`, `CORS_ORIGIN` (Vercel URL)
- Vercel frontend → `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` (Railway URL)

---

## 8. Document Map

| Document | Path | Status |
|---------|------|--------|
| Product Requirements | `Docs/prd.md` | Done |
| System Design (this doc) | `Docs/system-design.md` | Done |
| Backend Architecture | `Docs/backend.md` | Next |
| Frontend Architecture | `Docs/frontend.md` | Pending |
| README | `README.md` | Pending |
