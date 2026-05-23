import { z } from 'zod';
import { randomUUID } from 'crypto';
import { QUESTION_TYPES } from '@vedaai/shared';
import { PaperParseError } from './errors';

// LaTeX commands that LLMs frequently emit without a leading backslash.
// We only patch inside $...$ / $$...$$ blocks so we don't mangle regular prose.
const LATEX_COMMANDS = [
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp',
  'frac', 'sqrt', 'sum', 'int', 'prod', 'lim',
  'pi', 'theta', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'lambda', 'mu', 'sigma', 'phi', 'omega',
  'Delta', 'Sigma', 'Omega', 'Phi', 'Theta',
  'circ', 'infty', 'partial', 'nabla',
  'leq', 'geq', 'neq', 'approx', 'equiv',
  'times', 'cdot', 'pm', 'mp', 'div',
  'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow',
  'cup', 'cap', 'in', 'notin', 'subset', 'supset',
  'mathbb', 'mathrm', 'mathbf', 'text',
  'left', 'right', 'binom', 'vec', 'bar', 'hat', 'tilde', 'overline', 'underline', 'overrightarrow',
];
const LATEX_COMMAND_PATTERN = new RegExp(
  `(?<![\\\\A-Za-z])(${LATEX_COMMANDS.join('|')})(?![A-Za-z])`,
  'g',
);

function patchLatexCommands(math: string): string {
  // Add backslash before known LaTeX commands when missing.
  let out = math.replace(LATEX_COMMAND_PATTERN, '\\$1');
  // Common typo: \degree → \circ (KaTeX doesn't recognize \degree by default)
  out = out.replace(/\\degree\b/g, '\\circ');
  return out;
}

// LLMs frequently emit "\frac" / "\right" with a single backslash inside JSON.
// JSON.parse then consumes the escape, leaving an orphan control char:
//   \f → U+000C  →  "\frac"   becomes  "[FF]rac"
//   \r → U+000D  →  "\right"  becomes  "[CR]ight"
//   \t → U+0009  →  "\theta"  becomes  "[TAB]heta"
//   \n → U+000A  →  "\neq"    becomes  "[LF]eq"
//   \b → U+0008  →  "\beta"   becomes  "[BS]eta"
//   \v → U+000B  →  "\vec"    becomes  "[VT]ec"
// We pattern-match the control char + likely LaTeX tail and restore the backslash.
//
// Build patterns via RegExp constructor with \xNN hex escapes so the source
// stays free of literal control characters.
interface MangleRule {
  ctrl: '\\f' | '\\r' | '\\t' | '\\n' | '\\b' | '\\v';
  hex: string;
  tails: string[]; // longest first
}
const MANGLE_RULES: MangleRule[] = [
  { ctrl: '\\f', hex: '\\x0C', tails: ['rac', 'box', 'rm', 'orall', 'loor'] },
  { ctrl: '\\r', hex: '\\x0D', tails: ['ightarrow', 'ight', 'angle', 'm'] },
  { ctrl: '\\t', hex: '\\x09', tails: ['extbf', 'extit', 'ext', 'imes', 'heta', 'an'] },
  { ctrl: '\\n', hex: '\\x0A', tails: ['otin', 'abla', 'eq', 'ot'] },
  { ctrl: '\\b', hex: '\\x08', tails: ['inom', 'eta', 'ar', 'ig', 'mod'] },
  { ctrl: '\\v', hex: '\\x0B', tails: ['arepsilon', 'arphi', 'ec'] },
];

const MANGLE_REPLACEMENTS: Array<{ re: RegExp; replacement: string }> = MANGLE_RULES.flatMap(
  ({ ctrl, hex, tails }) =>
    tails.map((tail) => ({
      re: new RegExp(`${hex}${tail}\\b`, 'g'),
      replacement: `${ctrl}${tail}`,
    })),
);

function repairJsonMangledLatex(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, replacement } of MANGLE_REPLACEMENTS) {
    out = out.replace(re, replacement);
  }
  return out;
}

// Recover bare LaTeX-style tokens that LLMs sometimes emit without ANY backslash.
// We act when the input is recoverable (cmd followed by braces, parens, or digit args).
// Truly ambiguous cases (e.g. "fracy2 - y1x2 - x1") flow through to the quality gate
// which throws so BullMQ retries with the LLM.
function recoverBareMathCommands(text: string): string {
  let out = text;

  // name followed by `{...}` — "frac{a}{b}", "sqrt{x}", "binom{n}{k}"
  // MUST use (?<!\\) not \b: \b fires between \ (non-word) and s (word char), so
  // \sqrt{ would be re-matched and produce \\sqrt{ (double backslash bug).
  out = out.replace(
    /(?<!\\)(frac|sqrt|sum|int|prod|lim|binom|vec|bar|hat|tilde|overline|underline|cdot|times|pi|theta|alpha|beta|gamma|delta|sigma|lambda|mu|omega|infty|circ|right|left|sin|cos|tan|log|ln)\{/g,
    '\\$1{',
  );

  // sqrt(...) with matching parens — "sqrt(2^2 + 3^2)" → "\sqrt{2^2 + 3^2}"
  out = out.replace(/(?<!\\)sqrt\(([^()]{1,80})\)/g, '\\sqrt{$1}');

  // "frac<3 digits>" — e.g. "frac145" → "\frac{14}{5}", "frac115" → "\frac{11}{5}"
  // First two digits = numerator, last = denominator (most common LLM pattern for coordinates/ratios).
  out = out.replace(/(?<!\\)frac(\d{2})(\d)(?!\d)/g, '\\frac{$1}{$2}');
  // "frac<2 digits>" — "frac32" → "\frac{3}{2}"
  out = out.replace(/(?<!\\)frac(\d)(\d)/g, '\\frac{$1}{$2}');

  // "sqrt<digit+>" — "sqrt52", "sqrt13"
  out = out.replace(/(?<!\\)sqrt(\d+)/g, '\\sqrt{$1}');

  // operator + (digit or whitespace+digit) — "cdot1", "cdot 1", "times2"
  out = out.replace(/(?<!\\)(cdot|times|pm|mp|div)\s*(\d)/g, '\\$1 $2');

  // bare Greek/operator names that frequently slip through, when adjacent to math context
  // (surrounded by digits, operators, or already-backslashed commands)
  const SHORT_NAMES = 'pi|theta|alpha|beta|gamma|delta|sigma|lambda|mu|omega|infty|circ';
  out = out.replace(new RegExp(`(?<![\\\\A-Za-z])(${SHORT_NAMES})(?=[\\s\\^_\\d\\+\\-\\*\\/\\)\\}\\$])`, 'g'), '\\$1');

  return out;
}

// Quality gate: scan parsed text for unmistakeable signs that LLM output is broken
// AND our recovery couldn't fix it. Returns a list of issues; empty = clean.
// Used after all normalization runs.
function detectBrokenMath(text: string): string[] {
  if (!text) return [];
  const issues: string[] = [];
  // Strip out everything inside $...$ and $$...$$ so we're checking only prose.
  const stripped = text
    .replace(/\$\$[\s\S]+?\$\$/g, '')
    .replace(/\$[^\n$]+?\$/g, '')
    .replace(/<plot>[\s\S]+?<\/plot>/g, '')
    .replace(/<mermaid>[\s\S]+?<\/mermaid>/g, '');

  // After stripping math regions, these patterns are definitely broken:
  // "frac<letter>" — irrecoverable "fracy2", "fracx1"
  if (/\bfrac[a-zA-Z]/.test(stripped)) issues.push('bare "frac" with letter args (no braces)');
  // "frac<4+ digits>" — ambiguous split, irrecoverable (e.g. "frac1452")
  if (/\bfrac\d{4}/.test(stripped)) issues.push('bare "frac" with 4+ digit args (ambiguous)');
  // "sqrt<letter>" — irrecoverable "sqrtx", "sqrty"
  if (/\bsqrt[a-zA-Z]/.test(stripped)) issues.push('bare "sqrt" with letter arg (no braces)');
  // Bare backslash-less command in prose with adjacent digit/letter/brace — recovery should have caught
  if (/\b(frac|sqrt|cdot|times|binom)\b(?!\\)/.test(stripped) && /\b(frac|sqrt|cdot)\b/.test(stripped)) {
    issues.push('remaining bare LaTeX command in prose');
  }
  return issues;
}

// Wrap `\command{...}` runs that aren't already inside $...$ in $...$ so KaTeX
// actually renders them. Splits on existing $-delimited regions first.
function autoWrapBackslashCommands(text: string): string {
  if (!text || !text.includes('\\')) return text;
  // Split by existing math regions so we only wrap the prose parts.
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\n$]+?\$)/g);
  const COMMAND_GROUP =
    /(\\(?:frac|sqrt|sum|int|prod|lim|binom|vec|bar|hat|tilde|overline|underline|cdot|times|pi|theta|alpha|beta|gamma|delta|sigma|lambda|mu|omega|infty|circ|right|left)(?:\{[^{}]*\}){0,2})/g;
  return parts
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // already in math, leave alone
      return seg.replace(COMMAND_GROUP, '$$$1$$');
    })
    .join('');
}

function normalizeLatexInText(text: string): string {
  if (!text) return text;
  // Step 0: undo JSON-escape mangling on LaTeX commands ( "\frac" → form-feed+rac → "\frac" )
  let working = repairJsonMangledLatex(text);
  // Step 1: recover bare commands that have NO backslash but unambiguous structure.
  working = recoverBareMathCommands(working);
  // Step 2: wrap restored \command{...} runs in $...$ when not already wrapped.
  working = autoWrapBackslashCommands(working);
  // Step 3: inside math blocks, add backslashes to known commands that are still bare.
  return working
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, body: string) => `$$${patchLatexCommands(body)}$$`)
    .replace(/\$([^\n$]+?)\$/g, (m, body: string) => {
      // Heuristic: looks like math if it contains \, ^, _, {}, or known command names. Otherwise leave alone.
      if (/[\\^_{}]|sin|cos|tan|frac|sqrt|pi|theta|circ|infty/i.test(body)) {
        return `$${patchLatexCommands(body)}$`;
      }
      return m;
    });
}

// Auto-wrap bare LaTeX commands in $...$ when the LLM forgets to do so.
// Common in MCQ options like "C. \frac{4}{3}" or "B. \sqrt{2}".
// Strategy: if a string has a bare LaTeX command (backslash + known cmd) AND
// contains no $ already, wrap the math portion (preserving any "A. "/"B) " prefix).
const BARE_LATEX_PROBE = /\\(?:frac|sqrt|sum|int|lim|prod|pi|theta|alpha|beta|gamma|delta|sigma|lambda|mu|omega|infty|circ|right|left)\b/;

function wrapBareLatex(text: string): string {
  if (!text || text.includes('$')) return text;
  if (!BARE_LATEX_PROBE.test(text)) return text;
  const prefixMatch = text.match(/^\s*([A-E])[.)]\s+/);
  if (prefixMatch) {
    const prefix = prefixMatch[0];
    const body = text.slice(prefix.length);
    return `${prefix}$${body}$`;
  }
  return `$${text}$`;
}

const QuestionOutputSchema = z.object({
  number: z.number().int().positive(),
  text: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  marks: z.number().positive(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
});

const SectionOutputSchema = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
  questionType: z.enum(QUESTION_TYPES),
  totalMarks: z.number().positive(),
  questions: z.array(QuestionOutputSchema).min(1, 'Section must have at least one question'),
});

export type ParsedQuestion = z.infer<typeof QuestionOutputSchema> & { id: string };
export type ParsedSection = Omit<z.infer<typeof SectionOutputSchema>, 'questions'> & {
  id: string;
  questions: ParsedQuestion[];
};

export interface ParsedPaper {
  paperTitle: string;
  schoolName?: string;
  subject: string;
  gradeLevel: string;
  totalMarks: number;
  duration?: string;
  instructions?: string[];
  sections: ParsedSection[];
}

export { PaperParseError, normalizeLatexInText };

export interface ExpectedSection {
  count: number;     // exact number of questions LLM must produce
  marksEach: number; // per-question marks; section total = count * marksEach
}

export function parseSections(
  sectionJsonStrings: string[],
  meta: {
    paperTitle: string;
    schoolName?: string;
    subject: string;
    gradeLevel: string;
    totalMarks: number;
    duration?: string;
    instructions?: string[];
  },
  expected?: ExpectedSection[],
): ParsedPaper {
  const sections = sectionJsonStrings.map((raw, i) => {
    let parsed: unknown;
    try {
      // Strip markdown fences Groq/some models wrap around JSON responses
      const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      parsed = JSON.parse(stripped);
    } catch {
      throw new PaperParseError(`Section ${i + 1} returned non-JSON response from LLM`);
    }

    const result = SectionOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new PaperParseError(
        `Section ${i + 1} has invalid structure: ${result.error.errors[0]?.message ?? 'unknown error'}`,
      );
    }

    const expectedSection = expected?.[i];
    const llmCount = result.data.questions.length;

    // Enforce exact question count when caller specified expectations.
    if (expectedSection) {
      if (llmCount !== expectedSection.count) {
        throw new PaperParseError(
          `Section ${i + 1} returned ${llmCount} questions, expected ${expectedSection.count}. ` +
            `LLM did not honour breakdown — BullMQ will retry.`,
        );
      }
    }

    // Force per-question marks + section total to expected values so the final
    // paper matches the teacher's input exactly. LLM-emitted marks values are
    // often off-by-one due to rounding; we trust the breakdown instead.
    const enforcedMarks = expectedSection?.marksEach;
    const enforcedSectionTotal = expectedSection
      ? expectedSection.count * expectedSection.marksEach
      : result.data.totalMarks;

    const cleanedQuestions = result.data.questions.map((q, qi) => ({
      ...q,
      id: randomUUID(),
      number: qi + 1,
      marks: enforcedMarks ?? q.marks,
      text: normalizeLatexInText(q.text),
      answer: q.answer ? normalizeLatexInText(wrapBareLatex(q.answer)) : q.answer,
      options: q.options?.map((opt) => normalizeLatexInText(wrapBareLatex(opt))),
    }));

    // Quality gate: after normalization, any remaining bare LaTeX is irrecoverable.
    // Throwing PaperParseError triggers BullMQ retry — LLM gets another shot with
    // the strengthened prompt rather than shipping garbled math to the user.
    for (const q of cleanedQuestions) {
      const blobs = [q.text, q.answer ?? '', ...(q.options ?? [])];
      for (const blob of blobs) {
        const issues = detectBrokenMath(blob);
        if (issues.length) {
          throw new PaperParseError(
            `Section ${i + 1} question ${q.number} has irrecoverable math markup: ${issues.join('; ')}. Sample: "${blob.slice(0, 100)}"`,
          );
        }
      }
    }

    return {
      ...result.data,
      totalMarks: enforcedSectionTotal,
      id: randomUUID(),
      questions: cleanedQuestions,
    };
  });

  // Recompute paper-level total from authoritative section totals.
  const totalMarks = sections.reduce((sum, s) => sum + s.totalMarks, 0);

  return { ...meta, totalMarks, sections };
}
