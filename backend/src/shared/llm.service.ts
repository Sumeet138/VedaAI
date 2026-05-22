import { env } from '../config/env';
import { buildSectionPrompt } from './prompt-builder';
import { groqService } from './groq.service';
import { geminiService } from './gemini.service';
import type { QuestionType } from '@vedaai/shared';

export class LlmQuotaExhaustedError extends Error {
  readonly nonRetryable = true;
  constructor(message: string, public readonly provider: string) {
    super(message);
    this.name = 'LlmQuotaExhaustedError';
  }
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 429) return true;
  const msg = String(e.message ?? '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('429');
}

// Provider interface — any object matching this shape can slot into the chain.
interface LLMProvider {
  name: string;
  isEnabled(): boolean;
  generateSectionJson(prompt: string, label: string): Promise<string>;
}

const PROVIDERS: Record<string, LLMProvider> = {
  groq: groqService,
  gemini: geminiService,
};

/**
 * Build the ordered provider chain from env config.
 * Switch primary/fallback with LLM_PRIMARY / LLM_FALLBACK in .env — no code changes needed.
 *
 * Examples:
 *   LLM_PRIMARY=groq   LLM_FALLBACK=gemini  → [groq, gemini]  (default)
 *   LLM_PRIMARY=gemini LLM_FALLBACK=groq    → [gemini, groq]
 *   LLM_PRIMARY=gemini LLM_FALLBACK=none    → [gemini]
 */
function buildProviderChain(): LLMProvider[] {
  const chain: LLMProvider[] = [];
  const primary = PROVIDERS[env.LLM_PRIMARY];
  if (primary?.isEnabled()) chain.push(primary);

  if (env.LLM_FALLBACK !== 'none') {
    const fallback = PROVIDERS[env.LLM_FALLBACK];
    if (fallback?.isEnabled() && fallback !== primary) chain.push(fallback);
  }

  return chain;
}

// Quick check on raw LLM JSON output for patterns the parser+renderer can't recover from.
function hasIrrecoverableMath(rawJson: string): boolean {
  const stripped = rawJson
    .replace(/\$\$[\s\S]+?\$\$/g, '')
    .replace(/\$[^\n$]+?\$/g, '');
  if (/\bfrac[a-zA-Z]/.test(stripped)) return true;
  if (/\bsqrt[a-zA-Z]/.test(stripped)) return true;
  if (/\b(frac|sqrt|cdot)\d/.test(stripped) && stripped.length > 50) return true;
  return false;
}

const STRICT_RETRY_ADDENDUM = `

=== RETRY — YOUR PREVIOUS ATTEMPT WAS REJECTED ===
The previous output contained bare LaTeX commands like "fracy2", "sqrt18", or "cdot1" without backslashes or $...$ wrapping.
This is the #1 reason your output gets rejected. Re-read these rules:

1. EVERY math expression — every fraction, every square root, every Greek letter, every operator like \\\\cdot — MUST be wrapped in $...$. No exceptions.
2. Inside JSON strings, every backslash MUST be DOUBLED. So you write "$\\\\frac{a}{b}$" in JSON, which after parse becomes $\\frac{a}{b}$.
3. Fractions have braces. "$\\\\frac{numerator}{denominator}$". NEVER "frac35" or "frac y2 x1".
4. Square roots have braces. "$\\\\sqrt{18}$". NEVER "sqrt18" or "sqrt(...)".

Examples of what you did WRONG and what to do INSTEAD:
- WRONG: "answer": "sqrt18"               → CORRECT: "answer": "$\\\\sqrt{18}$"
- WRONG: "answer": "frac35"               → CORRECT: "answer": "$\\\\frac{3}{5}$"
- WRONG: "answer": "fracy2 - y1x2 - x1"   → CORRECT: "answer": "$\\\\frac{y_2 - y_1}{x_2 - x_1}$"
- WRONG: "C. sqrt2"                       → CORRECT: "C. $\\\\sqrt{2}$"

Regenerate the section now. Same structure, same question count, EVERY single math expression must follow the rules above.`;

/**
 * Call a provider once; if output looks irrecoverably broken on math,
 * re-prompt that same provider with an explicit fix-addendum.
 * Saves us from a full BullMQ retry that would redo already-good sections.
 */
async function callWithMathRetry(
  fn: (p: string) => Promise<string>,
  prompt: string,
  label: string,
  providerLabel: string,
): Promise<string> {
  const first = await fn(prompt);
  if (!hasIrrecoverableMath(first)) return first;
  console.warn(`[llm] ${label} (${providerLabel}): bare-LaTeX detected, retrying with strict addendum`);
  try {
    return await fn(prompt + STRICT_RETRY_ADDENDUM);
  } catch (e) {
    console.warn(`[llm] ${label} (${providerLabel}): retry call failed, returning first attempt`, e);
    return first;
  }
}

async function generateSection(prompt: string, label: string): Promise<string> {
  const chain = buildProviderChain();

  if (chain.length === 0) {
    throw new Error('No LLM provider configured or enabled. Set GROQ_API_KEY and/or GEMINI_API_KEY.');
  }

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const isLast = i === chain.length - 1;

    try {
      return await callWithMathRetry(
        (p) => provider.generateSectionJson(p, label),
        prompt,
        label,
        provider.name,
      );
    } catch (err) {
      if (isQuotaError(err)) {
        if (!isLast) {
          console.warn(`[llm] ${label}: ${provider.name} quota exhausted, trying ${chain[i + 1].name}`);
          continue;
        }
        throw new LlmQuotaExhaustedError(
          `All providers exhausted quota for ${label}. Last provider: ${provider.name}`,
          provider.name,
        );
      }
      // Non-quota error from last provider — surface it; let BullMQ retry decide.
      if (isLast) throw err;
      console.warn(`[llm] ${label}: ${provider.name} failed (non-quota), trying ${chain[i + 1].name}`, err);
    }
  }

  throw new Error(`All LLM providers failed for ${label}`);
}

export interface SectionPlanItem {
  type: QuestionType;
  count: number;
  marksEach: number;
}

export function planSections(input: {
  questionTypes: QuestionType[];
  totalQuestions: number;
  totalMarks: number;
  additionalInstructions?: string;
}): { plan: SectionPlanItem[]; cleanedInstructions: string | undefined } {
  const { questionTypes, totalQuestions, totalMarks } = input;
  let userInstructions = input.additionalInstructions ?? '';
  let breakdown: Array<{ type: QuestionType; count: number; marks: number }> | undefined;

  if (userInstructions.includes('__METADATA__:')) {
    const parts = userInstructions.split('__METADATA__:');
    userInstructions = parts[0].trim();
    try {
      const meta = JSON.parse(parts[1]) as { breakdown?: typeof breakdown };
      breakdown = meta.breakdown;
    } catch (e) {
      console.error('Failed to parse metadata from additionalInstructions', e);
    }
  }

  const questionsPerSection = Math.ceil(totalQuestions / questionTypes.length);
  const marksPerSection = Math.ceil(totalMarks / questionTypes.length);

  const plan: SectionPlanItem[] = questionTypes.map((type, i) => {
    if (breakdown) {
      const typeOccurrence = questionTypes.slice(0, i).filter((t) => t === type).length;
      const matches = breakdown!.filter((b) => b.type === type);
      const hit = matches[typeOccurrence];
      if (hit) return { type, count: hit.count, marksEach: hit.marks };
    }
    const count = questionsPerSection;
    const marksEach = Math.max(1, Math.round(marksPerSection / count));
    return { type, count, marksEach };
  });

  return { plan, cleanedInstructions: userInstructions || undefined };
}

const SECTION_LABELS = ['Section A', 'Section B', 'Section C', 'Section D', 'Section E'];

interface GenerateAllSectionsParams {
  questionTypes: QuestionType[];
  totalQuestions: number;
  totalMarks: number;
  assignmentData: {
    title: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    additionalInstructions?: string;
  };
  extractedText?: string;
  onSectionComplete?: (info: { label: string; index: number; total: number }) => void;
}

export const llmService = {
  async generateAllSections(params: GenerateAllSectionsParams): Promise<string[]> {
    const { questionTypes, totalQuestions, totalMarks, assignmentData, extractedText, onSectionComplete } = params;

    const { plan, cleanedInstructions } = planSections({
      questionTypes,
      totalQuestions,
      totalMarks,
      additionalInstructions: assignmentData.additionalInstructions,
    });

    const cleanedAssignmentData = { ...assignmentData, additionalInstructions: cleanedInstructions };

    const results: string[] = [];
    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      const label = SECTION_LABELS[i] ?? `Section ${String.fromCharCode(65 + i)}`;
      const prompt = buildSectionPrompt({
        sectionLabel: label,
        questionType: item.type,
        questionCount: item.count,
        marksPerSection: item.count * item.marksEach,
        assignmentData: cleanedAssignmentData,
        extractedText,
      });
      const res = await generateSection(prompt, `${label}(${item.type})`);
      onSectionComplete?.({ label, index: i, total: plan.length });
      results.push(res);
    }
    return results;
  },
};
