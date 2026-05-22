import Groq from 'groq-sdk';
import { env } from '../config/env';
import type { QuestionType } from '@vedaai/shared';

const client = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

// Ordered fallback chain. First entry comes from env (default openai/gpt-oss-20b
// at time of writing). Subsequent entries are tried if the configured model
// is decommissioned, missing, or returns an `invalid_request_error`.
// Update this list when Groq deprecates models — see https://console.groq.com/docs/deprecations
const REASONING_FALLBACK_CHAIN = [
  env.GROQ_REASONING_MODEL,
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  env.GROQ_MODEL, // last resort: same model as base section generator
].filter((m, i, arr) => m && arr.indexOf(m) === i); // dedupe, drop empties

const STANDARD_FALLBACK_CHAIN = [
  env.GROQ_MODEL,
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-20b',
].filter((m, i, arr) => m && arr.indexOf(m) === i);

// Cache of models we've already seen fail with a permanent error in this process.
// Skip them on subsequent calls so we don't repeatedly hit decommissioned endpoints.
const deadModels = new Set<string>();

function isPermanentModelError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; error?: { error?: { code?: string; type?: string } } };
  if (e.status !== 400 && e.status !== 404) return false;
  const code = e.error?.error?.code ?? '';
  const type = e.error?.error?.type ?? '';
  return (
    code === 'model_decommissioned' ||
    code === 'model_not_found' ||
    type === 'invalid_request_error'
  );
}

function pickChain(preferred: string | undefined, longForm: boolean): string[] {
  const base = longForm ? REASONING_FALLBACK_CHAIN : STANDARD_FALLBACK_CHAIN;
  const ordered = preferred ? [preferred, ...base.filter((m) => m !== preferred)] : base;
  return ordered.filter((m) => !deadModels.has(m));
}

async function callWithFallback<T>(
  chain: string[],
  label: string,
  exec: (model: string) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (const model of chain) {
    if (deadModels.has(model)) continue;
    try {
      return await exec(model);
    } catch (err) {
      lastErr = err;
      if (isPermanentModelError(err)) {
        console.warn(`[groq] ${label}: model "${model}" permanently unavailable, marking dead and trying next`);
        deadModels.add(model);
        continue;
      }
      // Transient / rate-limit / network — surface to caller (don't burn through the chain)
      throw err;
    }
  }
  throw lastErr ?? new Error(`Groq ${label}: all fallback models exhausted`);
}

interface QuestionInput {
  number: number;
  text: string;
  type: QuestionType;
  marks: number;
  options?: string[];
}

interface SectionContext {
  sectionTitle: string;
  subject: string;
  gradeLevel: string;
}

interface AnswerOpts {
  model?: string;
  longForm?: boolean;
}

const LONG_FORM_GUIDANCE = `
Because these are long-answer questions, structure EACH answer as:
1. State the main concept or law clearly.
2. Give the key formula, principle, or definition (use $...$ LaTeX where applicable).
3. Explain in 2–4 sentences with cause→effect reasoning.
4. End with a concrete example, real-life application, or worked numerical.

Total length per answer: 4–8 sentences. Avoid filler. Use LaTeX for math, \\ce{...} for chemistry, and <mermaid>...</mermaid> if a diagram would clarify.`;

function buildAnswerPrompt(
  section: SectionContext,
  questions: QuestionInput[],
  longForm: boolean,
): string {
  const lines = questions.map((q) => {
    const opts = q.options?.length ? `\n   Options: ${q.options.join(' | ')}` : '';
    return `${q.number}. [${q.type}, ${q.marks} mark${q.marks !== 1 ? 's' : ''}] ${q.text}${opts}`;
  });

  return `You are an expert teacher creating an answer key for a ${section.gradeLevel} ${section.subject} exam.

Section: ${section.sectionTitle}

Questions:
${lines.join('\n\n')}

Generate concise, accurate answers for EVERY question. Respond with ONLY valid JSON, no markdown, no extra prose:
{
  "answers": {
    "1": "answer for question 1",
    "2": "answer for question 2"
  }
}

Answer rules by question type:
- mcq: full correct option text (e.g. "B. Paris")
- true_false: exactly "True" or "False"
- fill_in_blank: just the word(s) that fill the blank
- short_answer: 1–3 sentence model answer
- long_answer: 3–6 sentence model answer or marking scheme
- numerical: worked solution with LaTeX ($...$) showing each step and the final numeric answer
- diagram: explanation of the diagram/graph with reference to its labelled parts

RICH-TEXT SYNTAX (use only when it improves clarity):
- Math/chem: $...$ inline or $$...$$ block, LaTeX syntax. Chemistry: \\ce{...}.
- Diagrams: <mermaid>graph LR; A-->B</mermaid> for circuits/flows/cycles.

CRITICAL JSON-ESCAPE RULE — read carefully:
This is a JSON response. EVERY backslash in LaTeX MUST be written as TWO backslashes in the JSON string.
- Correct JSON: "answer": "$\\\\frac{1}{2}$"           (renders as $\\frac{1}{2}$)
- WRONG JSON:   "answer": "$\\frac{1}{2}$"             (JSON eats \\f → form-feed → renders as garbage)
- Same for \\\\right, \\\\theta, \\\\nabla, \\\\beta — always double the backslash inside JSON.
- Any LaTeX command appearing in the answer MUST be wrapped in $...$ even if it's the whole answer (e.g. "$\\\\frac{4}{3}$" not "\\\\frac{4}{3}").

ABSOLUTELY FORBIDDEN — bare LaTeX names without backslash or braces:
- WRONG:   "Slope is fracy2 - y1x2 - x1, then frac32 = 1.5"
- WRONG:   "Distance is sqrt52 = 2 sqrt13"
- WRONG:   "result is 3 cdot1 + b = frac12"
- CORRECT: "Slope is $\\\\frac{y_2 - y_1}{x_2 - x_1}$, then $\\\\frac{3}{2} = 1.5$"
- CORRECT: "Distance is $\\\\sqrt{52} = 2\\\\sqrt{13}$"
- CORRECT: "result is $3 \\\\cdot 1 + b = \\\\frac{1}{2}$"

WORKED EXAMPLE of a complete answer field (note ALL math is wrapped in $...$ and every command has DOUBLE backslash):
"answer": "Use the slope formula $m = \\\\frac{y_2 - y_1}{x_2 - x_1}$. Substituting $(x_1, y_1) = (1, \\\\frac{3}{2})$ and $(x_2, y_2) = (2, \\\\frac{5}{2})$ gives $m = \\\\frac{\\\\frac{5}{2} - \\\\frac{3}{2}}{2 - 1} = 1$. The equation is $y = x + \\\\frac{1}{2}$."
${longForm ? LONG_FORM_GUIDANCE : ''}

Keys in "answers" MUST be string question numbers ("1", "2", …). Include every question number listed above.`;
}

function stripReasoning(raw: string): string {
  // DeepSeek R1 emits <think>…</think> reasoning trace before final output. Strip it.
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractJsonBlock(raw: string): string {
  // After stripping think tags, find the first {...} block in case model added prose.
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return '{}';
  return trimmed.slice(start, end + 1);
}

interface SuggestNameInput {
  subject: string;
  gradeLevel: string;
  topic?: string;
  questionTypes: QuestionType[];
}

export const groqService = {
  name: 'groq' as const,
  isEnabled: (): boolean => !!client,

  /**
   * Suggest a short assignment title following a consistent naming convention.
   * Format: "{Type} on {Topic}" or "{Type} - {Subject} - Class {N}" if no topic.
   * Type derives from the question mix: Quiz / Test / Worksheet / Exam / Practice.
   */
  async suggestAssignmentName(input: SuggestNameInput): Promise<string> {
    if (!client) {
      // Deterministic fallback without LLM
      const t = input.topic?.trim();
      return t
        ? `Test on ${t}`
        : `${input.subject} - Class ${input.gradeLevel}`;
    }

    const counts = input.questionTypes.reduce<Record<string, number>>((acc, t) => {
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    const breakdown = Object.entries(counts).map(([t, n]) => `${n}x ${t}`).join(', ');

    const prompt = `Suggest a short title for a student assignment.

Subject: ${input.subject}
Class: ${input.gradeLevel}
Topic: ${input.topic ?? '(not specified)'}
Question mix: ${breakdown}

NAMING CONVENTION (follow EXACTLY):
- If topic is given, format is "{Type} on {Topic}".
- If no topic, format is "{Type} - {Subject} - Class {N}".
- Type is one of: Quiz, Test, Worksheet, Exam, Practice.
- Type selection rule:
  - mostly mcq/true_false → Quiz
  - mostly fill_in_blank/short_answer → Worksheet
  - mostly long_answer/numerical/diagram → Test or Exam
  - mixed → Test
- Title MUST be 3-8 words, no extra punctuation, title-cased.

Respond ONLY with JSON: {"title": "Quiz on Photosynthesis"}`;

    const completion = await client.chat.completions.create({
      model: env.GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You write short, consistent assignment titles. Respond ONLY with JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 80,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    try {
      const parsed = JSON.parse(extractJsonBlock(stripReasoning(raw))) as { title?: string };
      const t = parsed.title?.trim();
      if (t && t.length <= 80) return t;
    } catch {
      // fall through
    }
    // Fallback
    const t = input.topic?.trim();
    return t ? `Test on ${t}` : `${input.subject} - Class ${input.gradeLevel}`;
  },

  /**
   * Generate a section's questions as JSON. Mirrors Gemini's generateSection shape.
   * Used as the primary section generator now that Gemini free-tier (20/day) is too tight.
   * Llama 3.3 70B on Groq free tier = 14,400 req/day — plenty of headroom.
   */
  async generateSectionJson(prompt: string, label: string): Promise<string> {
    if (!client) throw new Error('Groq client not configured (missing GROQ_API_KEY)');
    const chain = pickChain(env.GROQ_MODEL, false);
    return callWithFallback(chain, `section[${label}]`, async (model) => {
      const t0 = Date.now();
      console.log(`[groq:section] ${label} (${model}): requesting`);
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert educational assessment creator. Respond with ONLY valid JSON matching the schema in the user prompt. No markdown fences, no prose, no <think> tags. Every LaTeX command MUST have a backslash, every math expression MUST be wrapped in $...$, every backslash inside JSON MUST be doubled.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          // Lower temp = stricter adherence to JSON+math format rules.
          // We want determinism for structured outputs, not creative variation.
          temperature: 0.3,
          max_tokens: 4096,
        });
        const raw = completion.choices[0]?.message?.content ?? '{}';
        const cleaned = extractJsonBlock(stripReasoning(raw));
        console.log(`[groq:section] ${label} (${model}): ${cleaned.length} chars in ${Date.now() - t0}ms`);
        return cleaned;
      } catch (err) {
        console.error(`[groq:section] ${label} (${model}): FAILED after ${Date.now() - t0}ms`, err);
        throw err;
      }
    });
  },

  async generateAnswersForSection(
    questions: QuestionInput[],
    context: SectionContext,
    opts: AnswerOpts = {},
  ): Promise<Record<number, string>> {
    if (!client) throw new Error('Groq client not configured (missing GROQ_API_KEY)');

    const longForm = opts.longForm ?? false;
    const prompt = buildAnswerPrompt(context, questions, longForm);
    const chain = pickChain(opts.model, longForm);

    const { cleaned, model } = await callWithFallback(
      chain,
      `answers[${context.sectionTitle}]`,
      async (m) => {
        const completion = await client.chat.completions.create({
          model: m,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert educational assessment grader. You produce concise, accurate answer keys for exam questions. Respond ONLY with valid JSON.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: longForm ? 0.4 : 0.3,
          max_tokens: longForm ? 2048 : 1024,
        });
        const rawOutput = completion.choices[0]?.message?.content ?? '{}';
        return { cleaned: extractJsonBlock(stripReasoning(rawOutput)), model: m };
      },
    );

    let parsed: { answers?: Record<string, string> };
    try {
      parsed = JSON.parse(cleaned) as { answers?: Record<string, string> };
    } catch {
      throw new Error(
        `Groq returned non-JSON after cleanup (model=${model}): ${cleaned.slice(0, 200)}`,
      );
    }

    const result: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed.answers ?? {})) {
      const n = Number(k);
      if (Number.isInteger(n) && typeof v === 'string' && v.trim()) {
        result[n] = v.trim();
      }
    }
    return result;
  },
};
