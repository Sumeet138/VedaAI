import type { QuestionType } from '@vedaai/shared';

interface SectionPromptParams {
  sectionLabel: string;
  questionType: QuestionType;
  questionCount: number;
  marksPerSection: number;
  assignmentData: {
    title: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    additionalInstructions?: string;
  };
  extractedText?: string;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice Questions (MCQ) — provide 4 options labeled A, B, C, D',
  short_answer: 'Short Answer Questions — 1–3 sentence answers expected',
  long_answer: 'Long Answer / Essay Questions — detailed answers expected',
  true_false: 'True or False Questions',
  fill_in_blank: 'Fill in the Blank Questions — use ___ to indicate the blank',
  numerical:
    'Numerical Problems — multi-step math/physics problems requiring calculation. Every question MUST include LaTeX equations using $...$ inline and $$...$$ for block.',
  diagram:
    'Diagram-Based Questions — questions that reference or require a visual. Every question MUST include a <mermaid>...</mermaid> diagram OR a <plot>...</plot> graph as part of the question itself.',
};

const INSTRUCTION_HINT: Record<QuestionType, string> = {
  mcq: 'Choose the correct option for each question. Each question carries equal marks.',
  short_answer: 'Answer the following questions in 2–3 sentences each.',
  long_answer: 'Answer the following questions in detail. Draw diagrams wherever applicable.',
  true_false: 'State whether the following statements are True or False.',
  fill_in_blank: 'Fill in the blanks with the most appropriate word or value.',
  numerical: 'Solve the following problems. Show all working clearly.',
  diagram: 'Refer to the diagram or graph shown with each question. Answer based on what is illustrated.',
};

// Which section types may include diagrams (<mermaid>) and which may include plots (<plot>).
// Restricting these to relevant types reduces surface area for breakage (LLM-generated
// Mermaid grammar errors, plot JSON errors) in sections where they're not needed.
const VISUAL_RULES: Record<QuestionType, { plots: boolean; diagrams: boolean }> = {
  mcq:           { plots: false, diagrams: false },
  short_answer:  { plots: false, diagrams: false },
  long_answer:   { plots: false, diagrams: true  }, // optional flowchart aids
  true_false:    { plots: false, diagrams: false },
  fill_in_blank: { plots: false, diagrams: false },
  numerical:     { plots: true,  diagrams: false }, // math plots only
  diagram:       { plots: true,  diagrams: true  }, // both allowed/required
};

const MATH_SYNTAX_BLOCK = `MATH SYNTAX — inline: $\\\\frac{a}{b}$, $\\\\sqrt{x}$, $E=mc^2$. Block: $$...$$. Chemistry: $\\\\ce{2H2O}$.

LATEX RULES (CRITICAL — follow exactly):
1. JSON double-backslash: every \\ in LaTeX becomes \\\\ in JSON. "$\\\\frac{1}{2}$" ✓  "$\\frac{1}{2}$" ✗ (form-feed)  "frac12" ✗ (broken).
2. Wrap ALL math in $...$: "C. $\\\\frac{4}{3}$" ✓  "C. frac43" ✗  "C. \\\\frac{4}{3}" ✗.
3. Braces required: $\\\\frac{y_2-y_1}{x_2-x_1}$ ✓  $\\\\frac y_2 x_2$ ✗. Same for $\\\\sqrt{18}$ ✓  $\\\\sqrt18$ ✗.
4. Multi-char subscripts/superscripts: $x_{i+1}$ ✓  $x_i+1$ ✗. Degree: $30^\\\\circ$ ✓  $30^circ$ ✗.

MCQ EXAMPLE (exact format for options and answer):
"options": ["A. $2\\\\sqrt{2}$", "B. $\\\\sqrt{20}$", "C. $4$", "D. $2$"],
"answer": "A. $2\\\\sqrt{2}$"`;

const PLOT_SYNTAX_BLOCK = `FUNCTION PLOTS — <plot> blocks. Use ONLY when a graph genuinely clarifies the question (graphing y=f(x), coordinate geometry, conics). JSON inside the block, JS math syntax only (^ for power, * for multiply, no LaTeX).
- Single explicit function: <plot>{"fn":"x^2","xDomain":[-5,5],"yDomain":[-2,25],"title":"y = x²"}</plot>
- Multiple curves: <plot>{"data":[{"fn":"2*x+1"},{"fn":"x^2","color":"red"}],"xDomain":[-5,5]}</plot>
- Scatter points: <plot>{"points":[[0,0],[1,2],[2,4]],"xDomain":[0,5],"yDomain":[0,8]}</plot>
- Implicit (circles, conics — any equation not solvable as y=f(x)): move everything to one side =0, set fnType implicit:
  <plot>{"data":[{"fn":"(x-2)^2 + (y-3)^2 - 4","fnType":"implicit"}],"xDomain":[-2,6],"yDomain":[-1,7]}</plot>
  NEVER keep "=" inside fn. NEVER use LaTeX inside fn.`;

const DIAGRAM_SYNTAX_BLOCK = `MERMAID DIAGRAMS — <mermaid> blocks. Use ONLY for flowcharts, circuits, cycles, sequence diagrams. Keep <= 8 nodes.
- Valid syntax (flowchart):
  <mermaid>
  flowchart LR
    A[Start] --> B{Decision}
    B -- Yes --> C[Action]
    B -- No --> D[End]
  </mermaid>
- Edge labels go on the arrow as "-- text -->" NOT as "-->|text|>". WRONG: A -->|distance|> B. CORRECT: A -- distance --> B.
- Node labels in square brackets [Label] or curly braces {Decision} only — keep them simple, no special chars.
- Test mentally: every line must follow "Source [shape] (arrow) Target [shape]" with optional inline label.`;

export function buildSectionPrompt(params: SectionPromptParams): string {
  const { sectionLabel, questionType, questionCount, marksPerSection, assignmentData, extractedText } = params;

  const referenceBlock = extractedText
    ? `\nREFERENCE MATERIAL (use as knowledge source for questions):\n"""\n${extractedText.slice(0, 8000)}\n"""\n`
    : '';

  const visuals = VISUAL_RULES[questionType];
  const visualSyntaxBlocks: string[] = [];
  if (visuals.plots) visualSyntaxBlocks.push(PLOT_SYNTAX_BLOCK);
  if (visuals.diagrams) visualSyntaxBlocks.push(DIAGRAM_SYNTAX_BLOCK);

  // Explicit ban so the LLM doesn't sneak diagrams into MCQ/SA/etc anyway.
  const explicitBans: string[] = [];
  if (!visuals.plots) explicitBans.push('Do NOT emit <plot> blocks in this section.');
  if (!visuals.diagrams) explicitBans.push('Do NOT emit <mermaid> blocks in this section.');

  const banLine = explicitBans.length ? `\nFORBIDDEN IN THIS SECTION:\n- ${explicitBans.join('\n- ')}` : '';

  return `You are an expert educational assessment creator.

ASSIGNMENT: ${assignmentData.title}
SUBJECT: ${assignmentData.subject}
GRADE LEVEL: ${assignmentData.gradeLevel}${assignmentData.topic ? `\nTOPIC: ${assignmentData.topic}` : ''}
SECTION: ${sectionLabel}
QUESTION TYPE: ${TYPE_LABELS[questionType]}
NUMBER OF QUESTIONS: ${questionCount} (exact — do not produce more or fewer)
MARKS PER QUESTION: ${Math.round(marksPerSection / questionCount)}
TOTAL MARKS FOR THIS SECTION: ${marksPerSection}
${assignmentData.additionalInstructions ? `ADDITIONAL INSTRUCTIONS: ${assignmentData.additionalInstructions}` : ''}
${referenceBlock}
DIFFICULTY DISTRIBUTION: Aim for ~40% easy, ~40% medium, ~20% hard questions.
${banLine}

${MATH_SYNTAX_BLOCK}

${visualSyntaxBlocks.join('\n\n')}

ANSWER KEY RULES — for every question produce an "answer" field:
- mcq:           full correct option text (e.g. "B. $\\\\sqrt{20}$").
- true_false:    exactly "True" or "False".
- fill_in_blank: just the word(s) that fill the blank.
- short_answer:  1–3 sentence model answer.
- long_answer:   3–6 sentence model answer or marking scheme.
- numerical:     worked solution with LaTeX equations showing each step and the final numerical result.
- diagram:       explanation of the diagram/graph with reference to its labelled parts.

Respond with ONLY this JSON structure (no markdown fence, no prose outside the JSON):
{
  "title": "${sectionLabel}",
  "instruction": "${INSTRUCTION_HINT[questionType]}",
  "questionType": "${questionType}",
  "totalMarks": ${marksPerSection},
  "questions": [
    {
      "number": 1,
      "text": "question text here (math wrapped in $...$, commands escaped with \\\\)",
      "type": "${questionType}",
      "difficulty": "easy | medium | hard",
      "marks": ${Math.round(marksPerSection / questionCount)},
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "model answer here"
    }
  ]
}

Note: "options" field is REQUIRED for mcq, OMITTED for all other types. "answer" is REQUIRED for all types.`;
}
