import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai';
import { env } from '../config/env';

type GenerationConfigWithThinking = GenerationConfig & {
  thinkingConfig?: { thinkingBudget?: number };
};

const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

// Complex section types need a stronger model AND reasoning budget.
// Flip GEMINI_MODEL_MATH=gemini-2.5-pro in .env once billing is linked.
const COMPLEX_TYPES = new Set(['numerical', 'long_answer', 'diagram']);

function extractType(label: string): string {
  return /\((\w+)\)$/.exec(label)?.[1] ?? '';
}

function pickModel(type: string): string {
  return COMPLEX_TYPES.has(type) ? env.GEMINI_MODEL_MATH : env.GEMINI_MODEL;
}

// Simple sections: thinkingBudget=0 prevents repetition-loop bug, safe for structured JSON.
// Complex sections (diagram/numerical): give the model room to reason through
// Mermaid syntax and multi-step math — 0 budget causes it to skip diagram generation.
function pickThinkingBudget(type: string): number | undefined {
  return COMPLEX_TYPES.has(type) ? undefined : 0;
}

export const geminiService = {
  name: 'gemini' as const,

  isEnabled(): boolean {
    return !!genAI;
  },

  async generateSectionJson(prompt: string, label: string): Promise<string> {
    if (!genAI) throw new Error('Gemini not configured (missing GEMINI_API_KEY)');

    const type = extractType(label);
    const modelId = pickModel(type);
    const thinkingBudget = pickThinkingBudget(type);
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction:
        'You are an expert educational assessment creator. Respond with ONLY valid JSON. No markdown fences, no explanation, no extra text.',
    });

    const t0 = Date.now();
    const devLog = process.env.NODE_ENV !== 'production' ? console.log.bind(console) : () => {};
    devLog(`[gemini] ${label}: requesting (model=${modelId}, thinking=${thinkingBudget ?? 'default'}, prompt ${prompt.length} chars)`);

    const generationConfig: GenerationConfigWithThinking = {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.3,
    };
    if (thinkingBudget !== undefined) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      });
      const text = result.response.text();
      devLog(`[gemini] ${label}: ${text.length} chars in ${Date.now() - t0}ms (model=${modelId})`);
      return text;
    } catch (err) {
      console.error(`[gemini] ${label}: FAILED after ${Date.now() - t0}ms (model=${modelId})`, err);
      throw err;
    }
  },
};
