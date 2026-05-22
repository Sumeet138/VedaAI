# VedaAI — AI Assessment Creator

AI-powered platform where teachers describe an assignment and receive a fully formatted, difficulty-balanced question paper — with sections, math rendering, diagrams, plotted graphs, and a downloadable PDF.

**Live Demo:** _[deployed link here]_
**Submission:** [VedaAI Hiring Assignment Form](https://docs.google.com/forms/d/e/1FAIpQLSeL19GVvVT8vZrTx67hMWKTXLyJSyhkW5XGyzh7Ppt5w8P1jw/viewform)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 14 App Router  (Vercel)                                │
│  • Zustand stores  • react-hook-form + Zod  • Socket.io client  │
│  • KaTeX / Mermaid / function-plot rendering                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (REST) + Socket.io (rooms)
┌────────────────────────────▼────────────────────────────────────┐
│  Express + TypeScript  (Railway)                                │
│                                                                 │
│  REST API ──► BullMQ ─► Generation Worker ─► LLM fan-out        │
│       │            └──► PDF Worker (Puppeteer + Redis cache)    │
│  Socket.io ◄────── progress + completion + pdf:ready events     │
└──────┬──────────────────┬────────────────────┬──────────────────┘
       │                  │                    │
   MongoDB             Redis             Gemini • Groq
   (assignments,    (cache, PDFs,        (Gemini 2.5 Flash/Pro primary,
    papers)          BullMQ state)        Groq Llama 3.3 fallback)
```

### Generation flow

1. Teacher submits the create form → `POST /api/v1/assignments` (multipart).
2. Backend persists `Assignment`, enqueues a BullMQ job, returns `assignmentId`.
3. Frontend navigates to `/paper/{id}` and joins the Socket.io room.
4. Generation worker processes sections sequentially (rate-limit safe):
   - **Gemini 2.5 Flash** for standard sections (MCQ, fill-blank, true/false, short-answer).
   - **Gemini 2.5 Pro** for complex sections (numerical, long-answer, diagram) — better math and Mermaid.
   - **Groq Llama 3.3 70B** as automatic fallback when Gemini quota is exhausted.
5. Each response is Zod-validated, LaTeX-normalized, and saved as a `QuestionPaper` document.
6. Frontend renders the structured paper — never raw LLM text.

### PDF export flow

1. User clicks **Export PDF** → `POST /api/v1/papers/:id/export/pdf`.
2. If a cached PDF exists for the current version, the response returns the download path immediately.
3. Otherwise a job lands on the `pdf-export` BullMQ queue.
4. The PDF worker launches Puppeteer, navigates to a bare `/print/{id}` Next.js route (no chrome — sidebar/header are mounted in a parallel route group), waits for `window.__PAPER_READY`, and renders A4 PDF.
5. The buffer is cached in Redis (`pdf:{id}:v{version}`, TTL 1h) and the worker emits `pdf:ready` over Socket.io.
6. Frontend opens the download URL in a new tab.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 (App Router) | SSR + file-based routing, route groups for the bare PDF view |
| State | Zustand | Module-singleton stores survive App Router navigations |
| Forms | react-hook-form + Zod | Shared schemas mirror the backend |
| Realtime | Socket.io | Rooms keyed by `assignmentId`, auto-reconnect |
| Math | KaTeX | Inline + block LaTeX rendering |
| Diagrams | Mermaid | Flowcharts, sequence diagrams |
| Plots | function-plot (d3) | Real math graphs from `<plot>` JSON tags |
| Backend | Express + TypeScript | Typed, lean, fast cold start |
| Database | MongoDB (Mongoose) | Flexible nested `QuestionPaper` schema |
| Cache + Queue | Redis + BullMQ | Job state, paper cache, PDF buffer cache |
| PDF | Puppeteer | Renders the exact frontend layout — no jsPDF re-implementation |
| AI | Gemini 2.5 Flash/Pro · Groq Llama 3.3 | Multi-provider strategy with automatic fallback |
| Deploy | Vercel + Railway | Railway provisions MongoDB + Redis addons |

---

## Project Structure

```
VedaAi/
├── shared/                  # Types shared between frontend + backend (npm workspace)
│   └── src/models/          # assignment.types, question-paper.types, socket.types
├── backend/
│   └── src/
│       ├── assignments/     # routes + controller + service + Mongoose model
│       ├── papers/          # paper routes + Puppeteer pdf.service
│       ├── queue/
│       │   ├── queues.ts            # generationQueue + pdfQueue
│       │   ├── workers.ts           # both workers, error fan-out
│       │   └── processors/          # generation.processor + pdf.processor
│       ├── socket/          # Socket.io server + room management
│       ├── shared/          # groq / gemini services, prompt-builder, paper-parser, cache
│       ├── config/          # Zod-validated env, mongo, redis
│       └── middleware/      # error handler, multer upload, validate
└── frontend/
    ├── app/
    │   ├── (main)/          # Layout with Sidebar + Header + MobileBottomNav
    │   │   ├── assignments/         # list + /create
    │   │   └── paper/[id]/          # generated paper view
    │   └── print/[id]/      # BARE route — used by Puppeteer for PDF rendering
    ├── components/
    │   ├── ui/              # Sidebar, Header, MobileBottomNav
    │   ├── assignments/     # AssignmentForm, AssignmentList
    │   └── paper/           # PaperView, PrintPaperClient, SectionBlock,
    │                        # QuestionCard, AnswerKey, RichText, FunctionPlot
    ├── lib/                 # api.ts, socket.ts, profile.ts, mock.ts
    └── store/               # assignment.store, paper.store
```

---

## Local Development

### Prerequisites
- Node.js **20+**
- Docker (for MongoDB + Redis)
- A free **Groq** API key — [console.groq.com/keys](https://console.groq.com/keys)
- A free **Gemini** API key — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### 1. Clone & install

```bash
git clone https://github.com/your-username/vedaai.git
cd vedaai
npm install            # installs all workspaces (shared, backend, frontend)
```

### 2. Start MongoDB + Redis

```bash
docker compose up -d
```

### 3. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in GEMINI_API_KEY and GROQ_API_KEY

# Frontend
cp frontend/.env.local.example frontend/.env.local
```

The backend boots only if every required env var passes its Zod schema (`backend/src/config/env.ts`) — typos fail fast.

### 4. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open <http://localhost:3000>.

> The backend's `predev` script runs `kill-port 4000` to free a stuck port from a previous run.

---

## API Reference

### Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/assignments` | Create + queue generation job (`multipart/form-data`) |
| `GET` | `/api/v1/assignments` | List all assignments |
| `GET` | `/api/v1/assignments/:id` | Get assignment + current status |
| `DELETE` | `/api/v1/assignments/:id` | Delete assignment + its paper |
| `POST` | `/api/v1/assignments/suggest-name` | AI-suggested assignment title from subject/grade/topic |

### Papers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/papers/:assignmentId` | Get latest paper (Redis cache → MongoDB) |
| `POST` | `/api/v1/papers/:assignmentId/regenerate` | Re-run generation (increments version) |
| `POST` | `/api/v1/papers/:assignmentId/export/pdf` | Queue a PDF export — returns `{status: 'ready' \| 'queued'}` |
| `GET` | `/api/v1/papers/:assignmentId/export/pdf/download` | Stream cached PDF (404 if not yet rendered) |
| `GET` | `/api/v1/papers/:assignmentId/export/pdf` | Synchronous fallback — renders inline (slower) |

### WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `join:room` | Client → Server | `assignmentId` |
| `leave:room` | Client → Server | `assignmentId` |
| `job:progress` | Server → Client | `{ assignmentId, status, progress: 0–100, message }` |
| `job:completed` | Server → Client | `{ assignmentId, paperId }` |
| `job:failed` | Server → Client | `{ assignmentId, status: 'failed', message }` |
| `pdf:ready` | Server → Client | `{ assignmentId, version, downloadPath, cached }` |
| `pdf:failed` | Server → Client | `{ assignmentId, error }` |

---

## Key Design Decisions

**No raw LLM output anywhere on screen.**
Every section response runs through a Zod schema in `paper-parser.ts` before it's saved, including a `normalizeLatexInText()` pass that repairs broken commands (e.g. `sin(30^circ)` → `\sin(30^\circ)`). The frontend renders the validated Mongoose document — never an LLM string directly.

**Multi-provider LLM strategy.**
Gemini 2.5 Flash is the primary provider for standard sections; Gemini 2.5 Pro handles complex sections (numerical, diagram, long-answer) for better math/reasoning quality. Groq Llama 3.3 70B is the automatic fallback when Gemini quota is exhausted. Provider routing (`LLM_PRIMARY` / `LLM_FALLBACK`) is env-configurable — no code changes needed to swap providers. Quota-exhausted errors skip BullMQ retries via `LlmQuotaExhaustedError`.

**Sequential section generation.**
Sections are generated one at a time to stay within per-minute rate limits. Progress events (30%→70%) crawl forward as each section lands so the UI feels live.

**Puppeteer for PDF (not jsPDF).**
The PDF renders the exact frontend route at `/print/{id}` — KaTeX math, Mermaid diagrams, function-plot graphs, everything. The route group `app/print/` sits outside the `(main)` layout so the rendered page has no sidebar or header. The frontend signals readiness via `window.__PAPER_READY` and per-plot `data-plot-status` attributes so Puppeteer never screenshots a half-rendered diagram.

**PDF export runs through BullMQ.**
The synchronous endpoint is kept for backward compatibility, but the preferred flow is `POST /export/pdf` → cached descriptor or `{status: 'queued'}` → `pdf:ready` socket event → download. This keeps Express workers free during ~3–8s Puppeteer renders.

**Cache key versioning.**
`paper:{id}:v{version}` and `pdf:{id}:v{version}`. Regenerate increments the version, invalidating both keys atomically; old papers stay in MongoDB.

**Shared types via npm workspace.**
`shared/` re-exports `Assignment`, `QuestionPaper`, `JobProgressEvent`, `PdfReadyEvent`, and the `SOCKET_EVENTS` constants. Type drift between client and server is impossible by construction.

**Socket pre-warm on form mount.**
The Socket.io handshake starts as soon as the create page loads, so by the time the user submits and the app navigates to `/paper/{id}`, the connection is already open and the first progress event lands immediately.

**Optimistic progress seeding.**
After a successful `POST /assignments`, the Zustand store seeds a `status: 'queued', progress: 0` entry before the router navigates. The paper page renders the progress overlay without a flash of empty state.

---

## Features

- AI-powered question paper generation across 7 question types (MCQ, short, long, true/false, fill-in-blank, numerical, diagram)
- Real-time progress over Socket.io with 7-stage status updates
- AI-suggested assignment naming based on subject + class + topic
- Math rendering (KaTeX), diagrams (Mermaid), and actual plotted graphs (function-plot)
- PDF export via queued Puppeteer render — exact replica of the on-screen paper
- Regenerate with version history; old versions preserved in MongoDB
- Mobile-responsive (sidebar collapses to bottom nav, paper sheet stays readable on phones)
- Stuck-job detection with regenerate UI when a previous job died mid-flight

---

## Deployment

### Frontend → Vercel
1. Push the repo to GitHub.
2. Set Vercel's root directory to `frontend/`.
3. Set env vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` (both pointing at the Railway URL).

### Backend → Railway
1. New Railway project, root directory `backend/`.
2. Add **MongoDB** and **Redis** plugins — `MONGODB_URI` and `REDIS_URL` are injected automatically.
3. Set `GROQ_API_KEY`, `GEMINI_API_KEY`, `CORS_ORIGIN` (Vercel URL), `FRONTEND_URL` (Vercel URL).
4. The Nixpacks builder installs Chromium for Puppeteer automatically.

---

## Docs

| Document | Description |
|----------|-------------|
| [`Docs/prd.md`](Docs/prd.md) | Product requirements, feature specs, acceptance criteria |
| [`Docs/system-design.md`](Docs/system-design.md) | Architecture diagram, request flows, storage strategy |
| [`Docs/backend.md`](Docs/backend.md) | Express structure, data models, worker pipeline |
| [`Docs/frontend.md`](Docs/frontend.md) | Next.js structure, stores, socket hook, PDF export |
| [`Docs/assigment.md`](Docs/assigment.md) | Original assignment spec |
