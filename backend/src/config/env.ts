import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
  // Standard sections (MCQ, true/false, fill-blank, short-answer).
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  // Complex sections (numerical, long-answer, diagram) — upgrade to gemini-2.5-pro
  // once billing is linked for noticeably better math/reasoning quality.
  GEMINI_MODEL_MATH: z.string().default('gemini-2.5-flash'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_REASONING_MODEL: z.string().default('openai/gpt-oss-120b'),
  // Which provider to try first / second. Switching providers = 1 line in .env.
  LLM_PRIMARY: z.enum(['groq', 'gemini']).default('groq'),
  LLM_FALLBACK: z.enum(['groq', 'gemini', 'none']).default('gemini'),
  CORS_ORIGIN: z.string().min(1),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  WORKER_CONCURRENCY: z.coerce.number().default(2),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables — check your .env file');
}

export const env = parsed.data;
