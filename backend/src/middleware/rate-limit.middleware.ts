import rateLimit from 'express-rate-limit';

const msg = (text: string) => ({ success: false, error: text });

// General API protection — 100 req/min per IP.
export const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('Too many requests, please try again later.'),
});

// LLM-backed endpoints — 10 req/min per IP (paid API cost + quota).
export const llmLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('Too many AI requests, please wait a moment.'),
});

// Puppeteer PDF export — 5 req/min per IP (burst protection: heavy CPU + memory).
export const puppeteerLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('Too many PDF export requests, please wait a moment.'),
});

// Puppeteer PDF export — 10 req/hour per IP (sustained-abuse protection).
// Layered on top of puppeteerLimiter: a request must pass BOTH to proceed.
export const puppeteerHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('Hourly PDF export limit reached (10/hour). Try again later.'),
});

// LLM endpoints — 50 req/hour per IP (sustained-abuse protection on paid APIs).
export const llmHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: msg('Hourly AI request limit reached (50/hour). Try again later.'),
});
