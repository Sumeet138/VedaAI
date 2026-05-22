# Frontend Architecture
## VedaAI — Next.js 14 + TypeScript + Zustand

**Version:** 1.0  
**Date:** 2026-05-22

---

## 1. Project Structure

```
frontend/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local.example
└── src/
    ├── app/                            # Next.js App Router pages
    │   ├── layout.tsx                  # Root layout (providers, header)
    │   ├── page.tsx                    # Redirect → /create
    │   ├── create/
    │   │   └── page.tsx                # Assignment creation form page
    │   ├── assignments/
    │   │   └── page.tsx                # All assignments list
    │   └── paper/
    │       └── [assignmentId]/
    │           ├── page.tsx            # Output page (SSR status check)
    │           ├── loading.tsx         # Next.js loading UI
    │           └── error.tsx           # Error boundary
    │
    ├── components/
    │   ├── ui/                         # Primitive, stateless components
    │   │   ├── Button.tsx
    │   │   ├── Badge.tsx               # DifficultyBadge uses this
    │   │   ├── Input.tsx
    │   │   ├── Textarea.tsx
    │   │   ├── Select.tsx
    │   │   ├── Spinner.tsx
    │   │   └── ProgressBar.tsx
    │   │
    │   ├── forms/                      # Assignment creation form pieces
    │   │   ├── AssignmentForm.tsx      # Root form (react-hook-form)
    │   │   ├── FileUpload.tsx          # react-dropzone PDF upload
    │   │   ├── QuestionTypeSelect.tsx  # Multi-checkbox for question types
    │   │   └── DueDatePicker.tsx       # Date input with future-date validation
    │   │
    │   ├── paper/                      # Output page components
    │   │   ├── PaperView.tsx           # Container: header + student info + sections
    │   │   ├── PaperHeader.tsx         # Title, subject, grade, marks, duration
    │   │   ├── StudentInfoSection.tsx  # Name / Roll / Section input lines
    │   │   ├── SectionBlock.tsx        # Section A/B: title + instruction + questions
    │   │   ├── QuestionCard.tsx        # Single question: number + text + badge + marks
    │   │   ├── DifficultyBadge.tsx     # Easy=green / Medium=amber / Hard=red
    │   │   └── ActionBar.tsx           # Download PDF + Regenerate buttons
    │   │
    │   ├── progress/
    │   │   └── GenerationOverlay.tsx   # Full-screen progress (steps + bar)
    │   │
    │   └── layout/
    │       ├── Header.tsx
    │       └── PageWrapper.tsx
    │
    ├── store/
    │   ├── assignment.store.ts         # Form fields + submission state
    │   └── paper.store.ts             # Paper data + generation progress
    │
    ├── hooks/
    │   ├── useSocket.ts               # Socket.io lifecycle (connect/disconnect/rooms)
    │   ├── useAssignmentProgress.ts   # Listens to socket events → updates paper store
    │   └── useGeneratePaper.ts        # Submit form + join room + start polling
    │
    ├── lib/
    │   ├── api.ts                     # Axios instance (base URL, interceptors)
    │   └── socket.ts                  # Socket.io client singleton
    │   # PDF export is server-side — frontend hits GET /papers/:id/export/pdf
    │
    └── types/
        └── index.ts                   # Re-exports from @vedaai/shared
```

---

## 2. Routing

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Redirect to `/create` |
| `/create` | `create/page.tsx` | Assignment creation form |
| `/assignments` | `assignments/page.tsx` | List view with status badges |
| `/paper/:assignmentId` | `paper/[assignmentId]/page.tsx` | Output page |

---

## 3. State Management — Two Stores + One Hook

### 3.1 `store/assignment.store.ts`

Owns form fields and submission lifecycle.

```typescript
import { create } from 'zustand';
import type { QuestionType } from '@vedaai/shared';
import { api } from '../lib/api';

interface AssignmentStore {
  // Form fields
  title: string;
  subject: string;
  gradeLevel: string;
  dueDate: string;
  questionTypes: QuestionType[];
  totalQuestions: number;
  totalMarks: number;
  additionalInstructions: string;
  uploadedFile: File | null;

  // Submission state
  isSubmitting: boolean;
  error: string | null;
  createdAssignmentId: string | null;

  // Actions
  setField: <K extends keyof AssignmentStore>(key: K, value: AssignmentStore[K]) => void;
  toggleQuestionType: (type: QuestionType) => void;
  setFile: (file: File | null) => void;
  submit: () => Promise<{ assignmentId: string; jobId: string } | null>;
  reset: () => void;
}

export const useAssignmentStore = create<AssignmentStore>((set, get) => ({
  title: '', subject: '', gradeLevel: '', dueDate: '',
  questionTypes: [], totalQuestions: 10, totalMarks: 100,
  additionalInstructions: '', uploadedFile: null,
  isSubmitting: false, error: null, createdAssignmentId: null,

  setField: (key, value) => set({ [key]: value }),

  toggleQuestionType: (type) => {
    const current = get().questionTypes;
    set({
      questionTypes: current.includes(type)
        ? current.filter(t => t !== type)
        : [...current, type],
    });
  },

  setFile: (file) => set({ uploadedFile: file }),

  submit: async () => {
    set({ isSubmitting: true, error: null });
    try {
      const state = get();
      const formData = new FormData();
      formData.append('title', state.title);
      formData.append('subject', state.subject);
      formData.append('gradeLevel', state.gradeLevel);
      formData.append('dueDate', state.dueDate);
      formData.append('questionTypes', JSON.stringify(state.questionTypes));
      formData.append('totalQuestions', String(state.totalQuestions));
      formData.append('totalMarks', String(state.totalMarks));
      if (state.additionalInstructions) {
        formData.append('additionalInstructions', state.additionalInstructions);
      }
      if (state.uploadedFile) {
        formData.append('file', state.uploadedFile);
      }

      const { data } = await api.post('/assignments', formData);
      set({ createdAssignmentId: data.data.assignment._id, isSubmitting: false });
      return { assignmentId: data.data.assignment._id, jobId: data.data.jobId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      set({ error: message, isSubmitting: false });
      return null;
    }
  },

  reset: () => set({
    title: '', subject: '', gradeLevel: '', dueDate: '',
    questionTypes: [], totalQuestions: 10, totalMarks: 100,
    additionalInstructions: '', uploadedFile: null,
    isSubmitting: false, error: null, createdAssignmentId: null,
  }),
}));
```

### 3.2 `store/paper.store.ts`

Owns paper data AND generation progress (same page, tightly coupled).

```typescript
import { create } from 'zustand';
import type { QuestionPaper, Assignment, JobProgressEvent } from '@vedaai/shared';
import { api } from '../lib/api';

interface PaperStore {
  // Paper data
  paper: QuestionPaper | null;
  assignment: Assignment | null;
  isLoading: boolean;
  error: string | null;

  // Generation progress (from socket hook)
  progress: JobProgressEvent | null;
  isGenerating: boolean;

  // Actions
  fetchPaper: (assignmentId: string) => Promise<void>;
  setProgress: (event: JobProgressEvent) => void;
  onGenerationComplete: (paperId: string, assignmentId: string) => Promise<void>;
  onGenerationFailed: (error: string) => void;
  triggerRegenerate: (assignmentId: string) => Promise<string | null>;
  clear: () => void;
}

export const usePaperStore = create<PaperStore>((set, get) => ({
  paper: null, assignment: null, isLoading: false,
  error: null, progress: null, isGenerating: false,

  fetchPaper: async (assignmentId) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get(`/papers/${assignmentId}`);
      set({ paper: data.data.paper, assignment: data.data.assignment, isLoading: false });
    } catch {
      set({ error: 'Failed to load paper', isLoading: false });
    }
  },

  setProgress: (event) => set({ progress: event, isGenerating: event.progress < 100 }),

  onGenerationComplete: async (paperId, assignmentId) => {
    set({ isGenerating: false });
    await get().fetchPaper(assignmentId);
  },

  onGenerationFailed: (error) => {
    set({ isGenerating: false, error });
  },

  triggerRegenerate: async (assignmentId) => {
    set({ paper: null, progress: null, isGenerating: true, error: null });
    try {
      const { data } = await api.post(`/papers/${assignmentId}/regenerate`);
      return data.data.jobId;
    } catch {
      set({ isGenerating: false, error: 'Regenerate failed' });
      return null;
    }
  },

  clear: () => set({ paper: null, assignment: null, progress: null,
    isLoading: false, error: null, isGenerating: false }),
}));
```

---

## 4. Socket Hook — `hooks/useSocket.ts`

Socket is a side-effect, not state. This hook manages the socket lifecycle and pipes events into `usePaperStore`.

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';
import { usePaperStore } from '../store/paper.store';
import { SOCKET_EVENTS } from '@vedaai/shared';
import type { JobProgressEvent } from '@vedaai/shared';

export function useSocket(assignmentId: string | null) {
  const roomRef = useRef<string | null>(null);
  const { setProgress, onGenerationComplete, onGenerationFailed } = usePaperStore();

  useEffect(() => {
    if (!assignmentId) return;

    const socket = getSocket();

    // Join room for this assignment
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, assignmentId);
    roomRef.current = assignmentId;

    socket.on(SOCKET_EVENTS.JOB_PROGRESS, (event: JobProgressEvent) => {
      if (event.assignmentId === assignmentId) {
        setProgress(event);
      }
    });

    socket.on(SOCKET_EVENTS.JOB_COMPLETED, (event: JobProgressEvent) => {
      if (event.assignmentId === assignmentId && event.paperId) {
        onGenerationComplete(event.paperId, assignmentId);
      }
    });

    socket.on(SOCKET_EVENTS.JOB_FAILED, (event: { assignmentId: string; error: string }) => {
      if (event.assignmentId === assignmentId) {
        onGenerationFailed(event.error);
      }
    });

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_ROOM, assignmentId);
      socket.off(SOCKET_EVENTS.JOB_PROGRESS);
      socket.off(SOCKET_EVENTS.JOB_COMPLETED);
      socket.off(SOCKET_EVENTS.JOB_FAILED);
      roomRef.current = null;
    };
  }, [assignmentId]);
}
```

### `lib/socket.ts` — Singleton

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}
```

---

## 5. Form — `components/forms/AssignmentForm.tsx`

Uses `react-hook-form` + Zod resolver. Validation mirrors backend Zod schemas.

```typescript
const formSchema = z.object({
  title: z.string().min(3, 'Min 3 characters').max(200),
  subject: z.string().min(2).max(100),
  gradeLevel: z.string().min(1, 'Required'),
  dueDate: z.string().refine(d => new Date(d) > new Date(), 'Must be future date'),
  questionTypes: z.array(z.enum(QUESTION_TYPES)).min(1, 'Select at least one'),
  totalQuestions: z.coerce.number().int().min(1).max(100),
  totalMarks: z.coerce.number().int().min(1).max(500),
  additionalInstructions: z.string().max(1000).optional(),
});
```

On submit:
1. `react-hook-form` validates client-side
2. `useGeneratePaper` hook called
3. Assignment store `submit()` builds FormData + POSTs
4. On success: join socket room, set `isGenerating: true`, navigate to `/paper/:id`

---

## 6. Output Page — `app/paper/[assignmentId]/page.tsx`

Page logic on mount:
```
1. Check assignment status via GET /assignments/:id
   ├── status = 'completed' → fetchPaper() → render PaperView
   ├── status = 'processing' → set isGenerating=true, join socket room, show overlay
   ├── status = 'failed'    → show error + retry button
   └── status = 'pending'   → join socket room, show overlay (job not picked up yet)

2. useSocket(assignmentId) hook activated
3. Polling fallback: setInterval GET /assignments/:id every 3s
   └── Stop polling when status = 'completed' or 'failed'
   └── Also stops if socket 'completed' event arrives first
```

```typescript
// app/paper/[assignmentId]/page.tsx
'use client';

export default function PaperPage({ params }: { params: { assignmentId: string } }) {
  const { assignmentId } = params;
  const { paper, assignment, isGenerating, progress, error, fetchPaper } = usePaperStore();
  useSocket(isGenerating ? assignmentId : null);   // only connect when needed

  useEffect(() => {
    // Initial status check
    api.get(`/assignments/${assignmentId}`).then(({ data }) => {
      const status = data.data.status;
      if (status === 'completed') fetchPaper(assignmentId);
      else if (status === 'processing' || status === 'pending') {
        usePaperStore.getState().setProgress({ ..., isGenerating: true });
      }
    });

    // Polling fallback
    const interval = setInterval(async () => {
      const { data } = await api.get(`/assignments/${assignmentId}`);
      if (data.data.status === 'completed') {
        clearInterval(interval);
        fetchPaper(assignmentId);
      } else if (data.data.status === 'failed') {
        clearInterval(interval);
        usePaperStore.getState().onGenerationFailed(data.data.errorMessage);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [assignmentId]);

  if (isGenerating) return <GenerationOverlay progress={progress} />;
  if (error) return <ErrorState message={error} assignmentId={assignmentId} />;
  if (!paper) return <Spinner />;

  return <PaperView paper={paper} assignment={assignment!} />;
}
```

---

## 7. Output Components

### `PaperView.tsx` — layout skeleton
```
<article class="paper-container">
  <PaperHeader />
  <StudentInfoSection />
  <hr />
  {sections.map(section => <SectionBlock />)}
  <ActionBar />
</article>
```

### `SectionBlock.tsx`
```
<section>
  <h2>Section A — Multiple Choice Questions</h2>
  <p class="instruction">Attempt all questions. Each question carries 2 marks.</p>
  {questions.map(q => <QuestionCard />)}
</section>
```

### `QuestionCard.tsx`
```
<div class="question-row">
  <span class="q-number">1.</span>
  <div class="q-body">
    <p>{question.text}</p>
    {question.options && <MCQOptions options={question.options} />}
  </div>
  <div class="q-meta">
    <DifficultyBadge difficulty={question.difficulty} />
    <span class="marks">[{question.marks} marks]</span>
  </div>
</div>
```

### `DifficultyBadge.tsx`
```typescript
const config = {
  easy:   { label: 'Easy',   className: 'bg-green-100 text-green-800' },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-800' },
  hard:   { label: 'Hard',   className: 'bg-red-100 text-red-800'   },
};

export function DifficultyBadge({ difficulty }: { difficulty: DifficultyLevel }) {
  const { label, className } = config[difficulty];
  return <span className={`badge ${className}`}>{label}</span>;
}
```

### `GenerationOverlay.tsx`
Full-screen overlay with:
- Step indicator (Queued → Extracting → Prompting → Generating → Parsing → Saving → Done)
- Animated progress bar (`progress.progress` 0–100)
- Current step message (`progress.message`)

---

## 8. PDF Export — Server-Side LaTeX

PDF is generated server-side via `node-latex` + `pdflatex`. Frontend triggers download with a plain anchor tag — no client-side PDF library needed.

```typescript
// components/paper/ActionBar.tsx
const handleDownload = () => {
  // Browser navigates to endpoint → backend streams PDF → browser saves file
  window.open(
    `${process.env.NEXT_PUBLIC_API_URL}/papers/${assignmentId}/export/pdf`,
    '_blank'
  );
};
```

**Why server-side LaTeX is better:**
- Professional academic formatting (proper fonts, spacing, margins)
- `\hfill` for right-aligned marks — impossible cleanly in jsPDF
- Numbered lists, bold/italic, proper A4 layout via LaTeX packages
- No browser memory pressure for large papers
- Impresses interviewers — LaTeX PDF from a web app is rare

Backend compiles `.tex` → streams `application/pdf` → browser auto-downloads.  
See `Docs/backend.md § 12` for the LaTeX service implementation.

---

## 9. API Client — `lib/api.ts`

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
});

api.interceptors.response.use(
  res => res,
  err => {
    const message = err.response?.data?.error ?? err.message;
    return Promise.reject(new Error(message));
  }
);
```

---

## 10. Environment Variables

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://vedaai-backend.railway.app/api/v1` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://vedaai-backend.railway.app` |

---

## 11. Key Patterns

| Pattern | Where | Why |
|---------|-------|-----|
| Module-level Zustand stores | `store/*.ts` | Persist across App Router navigations (no Context needed) |
| Socket as hook, not store | `hooks/useSocket.ts` | Socket is a side-effect; progress state lives in `usePaperStore` |
| `'use client'` only where needed | Form + paper pages | Keep server components where possible |
| Zod on frontend too | `AssignmentForm.tsx` | Same schema shape as backend — consistent validation messages |
| Polling as fallback | `paper/[id]/page.tsx` | Socket drop or direct URL navigation still works |

---

## 12. Document Map

| Document | Path | Status |
|---------|------|--------|
| Product Requirements | `Docs/prd.md` | Done |
| System Design | `Docs/system-design.md` | Done |
| Backend Architecture | `Docs/backend.md` | Done |
| Frontend Architecture (this doc) | `Docs/frontend.md` | Done |
| README | `README.md` | Next |
