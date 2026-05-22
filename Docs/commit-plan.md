# VedaAI GitHub Commit Plan

21 commits across 3 branches. Timestamps: 2026-05-22 12:00 PM → 2026-05-23 09:00 AM.
Story: infra scaffold → backend build-out (afternoon/evening/night) → frontend (early morning).

---

## Execution Order

```
git init
git remote add origin <YOUR_REPO_URL>
```

Create each branch from `main` (empty). Commit in the order listed. Use `GIT_AUTHOR_DATE` + `GIT_COMMITTER_DATE` to set timestamps.

Template per commit:
```bash
GIT_AUTHOR_DATE="2026-05-22T12:07:00+05:30" \
GIT_COMMITTER_DATE="2026-05-22T12:07:00+05:30" \
git commit -m "<message>"
```

---

## Branch: `infrastructure` — 3 commits

Sets up the developer environment and deployment skeleton before any code.

---

### INFRA-1
- **Message**: `chore: docker-compose for MongoDB and Redis local dev`
- **Timestamp**: `2026-05-22T12:07:00+05:30`
- **Files**: `docker-compose.yml`, `.gitignore`, `package.json` (root workspaces)
- **What it represents**: Project kickoff — services come up with `docker compose up -d`. Workspace root declared.

### INFRA-2
- **Message**: `chore: env examples for backend and frontend`
- **Timestamp**: `2026-05-22T12:43:00+05:30`
- **Files**: `backend/.env.example`, `frontend/.env.example`
- **What it represents**: Document all required env vars before any service code is written.

### INFRA-3
- **Message**: `chore: railway deployment config and vercel build notes`
- **Timestamp**: `2026-05-22T13:22:00+05:30`
- **Files**: `backend/railway.toml`, `README.md`
- **What it represents**: Deployment targets locked in early. `railway.toml` sets `nixpacks` builder + `npm start`. README covers local dev + deploy URLs.

---

## Branch: `backend` — 12 commits

Full backend from Express boot to production-hardened API.

---

### BE-1
- **Message**: `feat: Express + TypeScript project scaffold with health check`
- **Timestamp**: `2026-05-22T13:45:00+05:30`
- **Files**: `backend/package.json`, `backend/tsconfig.json`, `backend/src/index.ts`, `backend/src/app.ts`
- **What it represents**: Bare server boots. `GET /health` returns 200. Entry point wires Express + Socket.io.

### BE-2
- **Message**: `feat: Zod env validation, MongoDB + Redis connection modules`
- **Timestamp**: `2026-05-22T14:28:00+05:30`
- **Files**: `backend/src/config/env.ts`, `backend/src/config/mongo.ts`, `backend/src/config/redis.ts`
- **What it represents**: Safe env parsing — process fails fast on missing vars. Connection helpers with retry logging.

### BE-3
- **Message**: `feat: Assignment and QuestionPaper Mongoose models`
- **Timestamp**: `2026-05-22T15:11:00+05:30`
- **Files**: `backend/src/models/assignment.model.ts`, `backend/src/models/paper.model.ts`, `shared/src/models/assignment.types.ts`, `shared/src/models/question-paper.types.ts`
- **What it represents**: Data layer complete. Shared types package mirrors Mongoose schemas for frontend type safety.

### BE-4
- **Message**: `feat: BullMQ queue setup with generation job type`
- **Timestamp**: `2026-05-22T15:58:00+05:30`
- **Files**: `backend/src/queue/queues.ts`, `backend/src/queue/workers.ts`, `backend/src/queue/processors/generation.processor.ts`
- **What it represents**: Queue and worker wired to Redis. Processor skeleton receives `{ assignmentId }` payload. Job retries = 3.

### BE-5
- **Message**: `feat: PDF text extraction via pdf-parse and Multer memory storage`
- **Timestamp**: `2026-05-22T16:44:00+05:30`
- **Files**: `backend/src/services/pdf-extract.service.ts`, `backend/src/middleware/upload.middleware.ts`
- **What it represents**: Teachers can upload a PDF — `extractedText` stored on assignment. Multer `memoryStorage()` required for Railway (no disk).

### BE-6
- **Message**: `feat: Groq LLM service with llama-3.3-70b section generation`
- **Timestamp**: `2026-05-22T17:33:00+05:30`
- **Files**: `backend/src/shared/groq.service.ts`, `backend/src/shared/prompt-builder.ts`
- **What it represents**: First working LLM integration. Section-per-request prompt design. Prompt builder assembles assignment metadata + extracted PDF text (8000 char cap).

### BE-7
- **Message**: `feat: Gemini service with model routing for complex section types`
- **Timestamp**: `2026-05-22T18:22:00+05:30`
- **Files**: `backend/src/shared/gemini.service.ts`
- **What it represents**: Gemini 2.5 Flash for standard sections; 2.5 Pro for `numerical`/`long_answer`/`diagram`. `thinkingBudget: 0` on simple types prevents repetition. `thinkingBudget: undefined` on complex types for full reasoning.

### BE-8
- **Message**: `feat: LLM provider abstraction with primary/fallback env chain`
- **Timestamp**: `2026-05-22T20:15:00+05:30`
- **Files**: `backend/src/shared/llm.service.ts`
- **What it represents**: `LLMProvider` interface. `buildProviderChain()` reads `LLM_PRIMARY`/`LLM_FALLBACK` env vars. Switching providers = 1 env var change, zero code changes.

### BE-9
- **Message**: `feat: paper parser with Zod validation and section UUID assignment`
- **Timestamp**: `2026-05-22T21:09:00+05:30`
- **Files**: `backend/src/utils/paper-parser.ts`
- **What it represents**: LLM raw JSON → validated `QuestionPaper`. UUIDs assigned post-parse. Typed `PaperParseError` thrown on schema mismatch → BullMQ retries.

### BE-10
- **Message**: `feat: Socket.io rooms with 7-step job progress events`
- **Timestamp**: `2026-05-22T22:37:00+05:30`
- **Files**: `backend/src/socket/socket.server.ts`, `backend/src/socket/socket.types.ts`, `shared/src/models/socket.types.ts`
- **What it represents**: Worker emits `job:progress` (0%–100%) at each pipeline step to room `assignmentId`. `job:completed` carries `paperId`. `job:failed` carries error message.

### BE-11
- **Message**: `feat: assignment and paper REST controllers with Redis cache`
- **Timestamp**: `2026-05-23T00:03:00+05:30`
- **Files**: `backend/src/assignments/assignment.controller.ts`, `backend/src/assignments/assignment.routes.ts`, `backend/src/papers/paper.controller.ts`, `backend/src/papers/paper.routes.ts`, `backend/src/services/cache.service.ts`
- **What it represents**: Full CRUD for assignments. Paper GET hits Redis cache first (`paper:{id}:v{n}`), falls through to MongoDB. Queued PDF export route + synchronous fallback.

### BE-12
- **Message**: `feat: helmet headers, rate limiting tiers, and API key auth middleware`
- **Timestamp**: `2026-05-23T02:17:00+05:30`
- **Files**: `backend/src/middleware/rate-limit.middleware.ts`, `backend/src/middleware/auth.middleware.ts`, `backend/src/app.ts`
- **What it represents**: Security hardening. `helmet()` on all routes. Layered rate limits: burst (10 LLM/min, 5 PDF/min) + sustained (50 LLM/hour, 10 PDF/hour). `VEDA_API_KEY` header guard — blank = open in dev.

---

## Branch: `frontend` — 6 commits

Next.js app from scaffold to polished, socket-connected UI.

---

### FE-1
- **Message**: `feat: Next.js 14 app scaffold with Zustand stores and socket client`
- **Timestamp**: `2026-05-23T03:01:00+05:30`
- **Files**: `frontend/package.json`, `frontend/app/layout.tsx`, `frontend/store/assignment.store.ts`, `frontend/store/paper.store.ts`, `frontend/store/socket.store.ts`, `frontend/lib/socket.ts`, `frontend/lib/api.ts`
- **What it represents**: App boots and connects to backend Socket.io. Zustand module-level singletons (not createContext) persist across App Router navigations. `api.ts` auto-sends `x-api-key` header.

### FE-2
- **Message**: `feat: assignment creation form with react-hook-form, Zod, and PDF dropzone`
- **Timestamp**: `2026-05-23T04:12:00+05:30`
- **Files**: `frontend/app/create/page.tsx`, `frontend/components/forms/CreateAssignmentForm.tsx`, `frontend/components/forms/QuestionTypeSelector.tsx`, `frontend/components/forms/PdfDropzone.tsx`
- **What it represents**: Multi-step form: metadata → question type picker → optional PDF upload. `questionTypes` serialized as `JSON.stringify(array)` in FormData. LLM title suggestion wired to `/suggest-name` endpoint.

### FE-3
- **Message**: `feat: paper view components — sections, questions, difficulty badges`
- **Timestamp**: `2026-05-23T05:33:00+05:30`
- **Files**: `frontend/app/paper/[id]/page.tsx`, `frontend/components/paper/PaperView.tsx`, `frontend/components/paper/SectionBlock.tsx`, `frontend/components/paper/QuestionCard.tsx`, `frontend/components/paper/DifficultyBadge.tsx`
- **What it represents**: Renders full `QuestionPaper` from validated backend data. MCQ options, fill-in-blank blanks, true/false styled differently per type.

### FE-4
- **Message**: `feat: socket progress tracking with animated job status panel`
- **Timestamp**: `2026-05-23T06:28:00+05:30`
- **Files**: `frontend/hooks/useAssignmentProgress.ts`, `frontend/components/progress/JobStatusPanel.tsx`, `frontend/components/progress/ProgressBar.tsx`
- **What it represents**: `job:progress` events update Zustand store → `ProgressBar` animates 0–100%. `job:completed` auto-navigates to paper page. `job:failed` shows inline error with retry option.

### FE-5
- **Message**: `feat: queued PDF export with download polling and sync fallback`
- **Timestamp**: `2026-05-23T07:42:00+05:30`
- **Files**: `frontend/components/paper/ExportPdfButton.tsx`, `frontend/hooks/usePdfExport.ts`, `frontend/lib/api.ts` (requestPdfExport, pdfDownloadUrl)
- **What it represents**: POST to enqueue export → socket `PDF_READY` event triggers download. Sync GET fallback for direct share links. `pdfDownloadUrl` strips `/api/v1` prefix to avoid double-path bug.

### FE-6
- **Message**: `feat: polish assignment cards, empty states, and responsive layout`
- **Timestamp**: `2026-05-23T08:51:00+05:30`
- **Files**: `frontend/app/assignments/page.tsx`, `frontend/components/ui/AssignmentCard.tsx`, `frontend/components/layout/Header.tsx`, `frontend/app/globals.css`
- **What it represents**: Dashboard cards show status badge, question count, grade level. Empty state with CTA. Header with logo and nav. Responsive grid (1-col mobile, 2-col tablet, 3-col desktop).

---

## Execution Script Skeleton

```bash
# ── INFRA BRANCH ──────────────────────────────────────────────
git checkout -b infrastructure

# INFRA-1
git add docker-compose.yml .gitignore package.json
GIT_AUTHOR_DATE="2026-05-22T12:07:00+05:30" GIT_COMMITTER_DATE="2026-05-22T12:07:00+05:30" \
git commit -m "chore: docker-compose for MongoDB and Redis local dev"

# INFRA-2
git add backend/.env.example frontend/.env.example
GIT_AUTHOR_DATE="2026-05-22T12:43:00+05:30" GIT_COMMITTER_DATE="2026-05-22T12:43:00+05:30" \
git commit -m "chore: env examples for backend and frontend"

# INFRA-3
git add backend/railway.toml README.md
GIT_AUTHOR_DATE="2026-05-22T13:22:00+05:30" GIT_COMMITTER_DATE="2026-05-22T13:22:00+05:30" \
git commit -m "chore: railway deployment config and vercel build notes"

git push -u origin infrastructure

# ── BACKEND BRANCH ────────────────────────────────────────────
git checkout main
git checkout -b backend

# BE-1 … BE-12 (follow same pattern, see timestamps above)
# git add <files>
# GIT_AUTHOR_DATE="..." GIT_COMMITTER_DATE="..." git commit -m "..."

git push -u origin backend

# ── FRONTEND BRANCH ───────────────────────────────────────────
git checkout main
git checkout -b frontend

# FE-1 … FE-6
git push -u origin frontend
```

---

## Pre-push Checklist

**CRITICAL — rotate before any `git push`:**
- [ ] `GEMINI_API_KEY` — generate new key in Google AI Studio
- [ ] `GROQ_API_KEY` — generate new key in GroqCloud console
- [ ] Confirm `backend/.env` is in `.gitignore` (it is — verify with `git status`)
- [ ] Confirm `frontend/.env.local` is in `.gitignore`
- [ ] `backend/.env.example` has placeholder values only (no real keys)

**Verify before push:**
```bash
git diff --cached -- "*.env"        # must be empty
git ls-files backend/.env           # must be empty (untracked)
git ls-files frontend/.env.local    # must be empty (untracked)
```
