# **VedaAI – Full Stack Engineering Assignment**

**Role:** Full Stack Engineer

**Duration:** 21 March (11:59PM)

**Submission:** GitHub Repository + Deployed link

---

# **Overview**

Build an AI **Assessment Creator** based on the provided Figma designs.

The system should allow a teacher to:

- Create an assignment
- Generate a question paper using AI
- View the generated output

Extra Points for creativity. (Functionality)

This is the **Figma file**, which you have to implement.

Figma : [Figma Designs for AI Assessment Creator](https://www.figma.com/design/nB2HMm1BhTpmHcHrmEslGB/VedaAI---Hiring-Assignment?node-id=0-1&t=UjYQLgEek4u99AA4-1)

# **Core Features**

---

## **1. Assignment Creation (Frontend)**

Using the Figma designs, build a form with:

- File upload (PDF / text) _(optional)_
- Due date
- Question types
- Number of questions + marks
- Additional instructions

### **Requirements:**

- Proper validation (no empty / negative values)
- Use Redux or Zustand for state management
- Websocket management

---

## **2. AI Question Generation**

### **Requirements:**

- Convert input → structured prompt
- Generate:
  - Sections (A, B, etc.)
  - Questions
  - Difficulty (easy / medium / hard)
  - Marks

Do not directly render LLM response.

---

## **3. Backend System**

### **Stack:**

- Node.js + Express (TypeScript)

### **Must include:**

- MongoDB → store assignments & results
- Redis → caching / job state
- BullMQ → background jobs (generation, PDF)
- WebSocket → real-time updates

### **Flow:**

1. API request
2. Job added to queue
3. Worker processes generation
4. Store result
5. Notify frontend

---

## **4. Output Page (Enhanced)**

Display the generated question paper in a **structured and well-designed format**, inspired by the provided UI.

### **Required Elements:**

### **Student Info Section**

- Name (input line)
- Roll Number (input line)
- Section (input line)

---

**Question Sections**

- Group questions into sections (e.g., Section A, B, etc.)
- Each section should include:
  - Title
  - Instruction (e.g., "Attempt all questions")
  - Questions list

Each question must display:

- Question text
- Difficulty tag (Easy / Moderate / Hard)
- Marks

---

### **UX Expectations**

- Clean, readable layout (similar to real exam papers)
- Proper spacing and hierarchy
- Mobile responsive

---

### **Bonus Features (Optional but High Signal)**

- Download as PDF (proper formatting, not raw HTML print)
- Action bar (Regenerate)
- Highlight difficulty visually (badges/tags)

### **Avoid**

- Rendering raw AI response
- Poor formatting or misaligned sections
- Single block of text without hierarchy

---

# **Tech Stack**

### **Frontend:**

- Next.js + TypeScript
- Redux / Zustand
- WebSocket

### **Backend:**

- Node.js + Express
- MongoDB
- Redis
- BullMQ

### **AI:**

- Any LLM (GPT / Claude / OSS)
- Prompt structuring + parsing required

---

# **Submission**

### **Submission Link : [Submit here](https://docs.google.com/forms/d/e/1FAIpQLSeL19GVvVT8vZrTx67hMWKTXLyJSyhkW5XGyzh7Ppt5w8P1jw/viewform?usp=dialog)**

### **1. GitHub Repo**

- Clean code
- Setup instructions

### **2. README**

- Architecture overview
- Approach

**Bonus (Optional)**

- PDF export
- Better caching
- Improved UI polish
