'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'motion/react';
import { Check, Loader2, Sparkles } from 'lucide-react';

const STEPS = [
  'queued',
  'extracting',
  'prompting',
  'generating',
  'parsing',
  'saving',
  'completed',
] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  queued: 'Waiting in queue',
  extracting: 'Reading uploaded material',
  prompting: 'Designing the question structure',
  generating: 'Composing questions with AI',
  parsing: 'Validating output format',
  saving: 'Saving your paper',
  completed: 'Done',
};

const STEP_HINT: Record<Step, string> = {
  queued: 'The worker will pick this up momentarily.',
  extracting: 'Parsing text from your reference document.',
  prompting: 'Assembling the structured prompt for the model.',
  generating: 'Multiple sections are being generated in parallel.',
  parsing: 'Checking every question matches the expected schema.',
  saving: 'Writing to the database and warming the cache.',
  completed: 'Loading the paper view…',
};

interface Props {
  progress: number;       // 0–100, jumps coarsely as backend emits events
  message: string;        // live server message
  status: string;         // one of STEPS
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export default function GenerationOverlay({ progress, message, status }: Props) {
  const currentStepIndex = STEPS.indexOf(status as Step);
  const isComplete = status === 'completed' || progress >= 100;

  // Smooth interpolated progress — bridges the gap between coarse server emissions.
  const smoothProgress = useSpring(0, {
    stiffness: 60,
    damping: 20,
    restDelta: 0.1,
  });
  const roundedProgress = useTransform(smoothProgress, (v) => Math.round(v));
  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    smoothProgress.set(progress);
  }, [progress, smoothProgress]);

  // Crawl forward ~1%/s while the server is silent — never let the bar feel frozen.
  // Capped at +12 above the last real value so we don't overshoot reality.
  const crawlRef = useRef<number>(0);
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      const current = smoothProgress.get();
      const ceiling = Math.min(progress + 12, 98);
      if (current < ceiling) {
        crawlRef.current = current + 0.6;
        smoothProgress.set(Math.min(crawlRef.current, ceiling));
      }
    }, 600);
    return () => clearInterval(interval);
  }, [progress, isComplete, smoothProgress]);

  // Subscribe to motion value for text update
  useEffect(() => {
    const unsub = roundedProgress.on('change', (v) => setDisplayPct(v));
    return () => unsub();
  }, [roundedProgress]);

  // Elapsed time
  const startedRef = useRef<number>(Date.now());
  const [elapsedLabel, setElapsedLabel] = useState('0s');
  useEffect(() => {
    const t = setInterval(() => {
      setElapsedLabel(formatElapsed(Date.now() - startedRef.current));
    }, 500);
    return () => clearInterval(t);
  }, []);

  // ETA — based on velocity. Crude but helpful.
  const etaLabel = (() => {
    const elapsed = Date.now() - startedRef.current;
    if (progress < 5 || isComplete) return null;
    const projected = (elapsed / progress) * 100;
    const remaining = Math.max(0, projected - elapsed);
    if (remaining < 1500) return null;
    return formatElapsed(remaining);
  })();

  const currentStep = (STEPS[currentStepIndex] ?? 'queued') as Step;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f6f3] px-4 relative overflow-hidden">
      {/* Soft ambient glow — subtle, off-brand orange */}
      <motion.div
        aria-hidden
        className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-[0.08] blur-3xl bg-orange-400"
        animate={{ scale: [1, 1.15, 1], opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full opacity-[0.07] blur-3xl bg-zinc-900"
        animate={{ scale: [1.1, 1, 1.1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] border border-zinc-200/60 px-8 py-9 w-full max-w-xl relative z-10"
      >
        {/* Eyebrow */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-zinc-500">
              Generating paper
            </span>
          </div>
          <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-zinc-400 tabular-nums">
            {elapsedLabel}{etaLabel ? ` · ~${etaLabel} left` : ''}
          </span>
        </div>

        {/* Big animated counter + dynamic step title */}
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.h2
                key={currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="text-[24px] md:text-[28px] font-extrabold text-zinc-900 tracking-[-0.02em] leading-[1.1] truncate"
              >
                {STEP_LABELS[currentStep]}…
              </motion.h2>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p
                key={message + currentStep}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-[13px] text-zinc-500 font-medium mt-1.5"
              >
                {message || STEP_HINT[currentStep]}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-[44px] md:text-[52px] font-extrabold text-zinc-900 tracking-[-0.04em] leading-none tabular-nums">
              {displayPct}
            </span>
            <span className="text-[18px] md:text-[22px] font-extrabold text-zinc-400 tracking-tight tabular-nums">%</span>
          </div>
        </div>

        {/* Progress bar with moving sheen */}
        <div className="relative h-1.5 bg-zinc-100 rounded-full overflow-hidden mb-7">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 rounded-full"
            style={{ width: useTransform(smoothProgress, (v) => `${v}%`) }}
          />
          {!isComplete && (
            <motion.div
              aria-hidden
              className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/60 to-transparent"
              animate={{ left: ['-15%', '110%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Step list */}
        <div className="space-y-1">
          {STEPS.slice(0, -1).map((step, i) => {
            const done = i < currentStepIndex;
            const active = i === currentStepIndex;
            return (
              <motion.div
                key={step}
                layout
                className="flex items-center gap-3 text-[13px] py-1.5"
                animate={{
                  opacity: done ? 0.4 : active ? 1 : 0.45,
                }}
                transition={{ duration: 0.3 }}
              >
                <motion.span
                  layout
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                    done
                      ? 'bg-zinc-900 border-zinc-900'
                      : active
                      ? 'bg-white border-orange-500'
                      : 'bg-white border-zinc-200'
                  }`}
                  animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  transition={active ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                >
                  {done ? (
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  ) : active ? (
                    <Loader2 className="w-3 h-3 text-orange-500 animate-spin stroke-[3]" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                  )}
                </motion.span>
                <span
                  className={`font-semibold transition-colors ${
                    done ? 'text-zinc-400 line-through decoration-zinc-200' : active ? 'text-zinc-900' : 'text-zinc-400'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Subtle footnote */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="text-[11px] font-medium tracking-[0.12em] uppercase text-zinc-400 mt-6 relative z-10"
      >
        You can leave this page — generation continues in the background
      </motion.p>
    </div>
  );
}
