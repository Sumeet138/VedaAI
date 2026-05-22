# Product Requirements Document
## VedaAI — AI Assessment Creator

**Version:** 1.0  
**Date:** 2026-05-22  
**Status:** Approved

---

## 1. Overview

VedaAI is a web application that lets teachers create structured question papers using AI. A teacher fills a form, the system generates a properly formatted exam paper in the background, and the teacher views (and optionally downloads) the result.

**Problem:** Creating well-structured, difficulty-balanced question papers is time-consuming for teachers.  
**Solution:** AI-powered generation with a clean UI — form in, paper out, real-time progress feedback.

---

## 2. Users

**Primary User: Teacher**
- Wants to create question papers quickly
- Cares about question quality, difficulty balance, and proper formatting
- Needs to download or print the paper for students

---

## 3. Core Features

### 3.1 Assignment Creation Form

Teacher fills a form with:

| Field | Type | Validation |
|-------|------|------------|
| Title | Text | Required, 3–200 chars |
| Subject | Text | Required, 2–100 chars |
| Grade Level | Text | Required (e.g. "Grade 10") |
| Due Date | Date | Required, must be future date |
| Question Types | Multi-select | Required, at least 1: MCQ / Short Answer / Long Answer / True-False / Fill in Blank |
| Total Questions | Number | Required, 1–100 |
| Total Marks | Number | Required, 1–500 |
| Additional Instructions | Textarea | Optional, max 1000 chars |
| Upload File (PDF/text) | File | Optional, max 10MB, PDF only |

**Behavior on Submit:**
- Validate all fields client-side (no empty, no negative values)
- Upload file if provided
- POST to backend — receive Assignment ID + Job ID
- Navigate to output page, join Socket.io room for this assignment
- Show progress overlay while generation runs

---

### 3.2 AI Question Generation

**What happens in the background:**
1. Teacher submits form → job added to BullMQ queue
2. Worker picks up job, builds structured prompt for Gemini
3. Gemini returns pure JSON (forced via `responseMimeType: 'application/json'`)
4. JSON validated against strict schema (Zod) — no raw LLM output ever reaches frontend
5. QuestionPaper saved to MongoDB, cached in Redis
6. Socket.io event sent to frontend with `paperId`

**Question distribution:** 40% easy / 40% medium / 20% hard (across all sections)

**Sections:** Questions grouped by type — each question type = one section (Section A, Section B, etc.)

---

### 3.3 Output Page

Displays generated question paper in exam-paper format:

**Header:**
- Paper title, subject, grade, total marks, duration

**Student Info Section:**
- Name: ________ Roll No: ________ Section: ________

**Question Sections (Section A, B, etc.):**
- Section title + instruction (e.g. "Attempt all questions")
- Questions numbered sequentially
- Each question shows: question text + difficulty badge + marks

**Difficulty Badges:**
- Easy → green badge
- Medium → amber badge
- Hard → red badge

**Action Bar:**
- Download as PDF (formatted, not raw HTML print)
- Regenerate (re-runs AI generation, increments version)

**UX requirements:**
- Clean exam-paper aesthetic
- Proper spacing and typographic hierarchy
- Mobile responsive

---

### 3.4 Assignments List Page

- Shows all created assignments
- Status indicator: pending / processing / completed / failed
- Click to open output page

---

## 4. Technical Constraints

| Constraint | Detail |
|-----------|--------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| State Management | Zustand |
| Realtime | Socket.io (WebSocket) |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB (assignments + papers) |
| Cache / Queue State | Redis |
| Background Jobs | BullMQ |
| AI | Google Gemini API (`gemini-2.0-flash`) |
| Deployment | Vercel (frontend) + Railway (backend + MongoDB + Redis) |

---

## 5. Non-Functional Requirements

- **No raw LLM output rendered** — all data goes through Zod schema validation
- **Job retries** — BullMQ retries failed jobs 3× with exponential backoff
- **Caching** — generated papers cached in Redis for 1 hour (key: `paper:{id}:v{version}`)
- **File handling** — Multer memory storage (no disk — Railway compatible)
- **Error states** — failed jobs show clear error message, option to retry

---

## 6. Out of Scope (v1)

- User authentication / multi-user
- Answer key generation
- Question bank / saved questions
- Sharing papers with students
- Analytics / usage tracking

---

## 7. Success Criteria

1. Teacher can submit form and see real-time progress (Socket.io events visible)
2. Generated paper has correct structure: sections → questions with difficulty + marks
3. Total marks of paper matches requested total
4. PDF download produces formatted, printable file
5. Regenerate produces a new version of the paper
6. Mobile layout is usable

---

## 8. Document Map

| Document | Path | Status |
|---------|------|--------|
| Product Requirements (this doc) | `Docs/prd.md` | Done |
| System Design | `Docs/system-design.md` | Next |
| Backend Architecture | `Docs/backend.md` | Pending |
| Frontend Architecture | `Docs/frontend.md` | Pending |
| README | `README.md` | Pending |
