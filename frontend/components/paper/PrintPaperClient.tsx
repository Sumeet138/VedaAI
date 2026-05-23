'use client';

import { useEffect, useState } from 'react';
import type { QuestionPaper } from '@vedaai/shared';
import { getPaper } from '@/lib/api';
import { PROFILE } from '@/lib/profile';
import SectionBlock from './SectionBlock';
import AnswerKey from './AnswerKey';

interface Props {
  assignmentId: string;
}

/**
 * Server-rendered print view used by Puppeteer.
 * No chrome (no sidebar, header, action bar). Just the paper.
 *
 * Exposes window.__PAPER_READY = true once data is fetched and DOM is hydrated,
 * so Puppeteer can `waitForFunction(() => window.__PAPER_READY)` instead of guessing.
 */
export default function PrintPaperClient({ assignmentId }: Props) {
  const [paper, setPaper] = useState<QuestionPaper | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPaper(assignmentId)
      .then(({ paper }) => setPaper(paper))
      .catch((e: Error) => {
        setError(e.message);
        (window as unknown as { __PAPER_ERROR?: string }).__PAPER_ERROR = e.message;
      });
  }, [assignmentId]);

  useEffect(() => {
    if (!paper) return;
    let cancelled = false;
    const fontsReady = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready
      ?? Promise.resolve();
    fontsReady.then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        (window as unknown as { __PAPER_READY?: boolean }).__PAPER_READY = true;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [paper]);

  if (error) {
    return <div style={{ padding: '24px', fontFamily: 'sans-serif', color: '#b91c1c' }}>Failed to load paper: {error}</div>;
  }

  if (!paper) {
    return <div style={{ padding: '24px', fontFamily: 'sans-serif', color: '#71717a' }}>Loading…</div>;
  }

  const schoolName = paper.schoolName ?? PROFILE.schoolFullName;
  const instructions = paper.instructions ?? ['All questions are compulsory unless stated otherwise.'];

  return (
    <article className="bg-white px-12 py-10 max-w-[800px] mx-auto">
      <header className="text-center mb-4">
        <h1 className="text-[22px] font-bold text-zinc-900 tracking-tight leading-tight">
          {schoolName}
        </h1>
        <p className="text-[15px] text-zinc-700 mt-1.5 font-semibold">Subject: {paper.subject}</p>
        <p className="text-[15px] text-zinc-700 font-semibold">Class: {paper.gradeLevel.replace(/^class\s+/i, '')}</p>
      </header>

      <div className="flex items-center justify-between border-t border-zinc-200 pt-4 mb-4">
        <span className="text-[13px] font-semibold text-zinc-700">
          Time Allowed: <span className="text-zinc-900">{paper.duration ?? '45 minutes'}</span>
        </span>
        <span className="text-[13px] font-semibold text-zinc-700">
          Maximum Marks: <span className="text-zinc-900">{paper.totalMarks}</span>
        </span>
      </div>

      <div className="mb-6">
        {instructions.map((line, i) => (
          <p key={i} className="text-[13px] text-zinc-700 font-semibold leading-relaxed">
            {line}
          </p>
        ))}
      </div>

      <div className="mb-8 text-[13px] text-zinc-800 font-semibold space-y-2">
        <p>Name: <span className="inline-block border-b border-zinc-400 w-56 ml-1 align-bottom h-4" /></p>
        <p>Roll Number: <span className="inline-block border-b border-zinc-400 w-40 ml-1 align-bottom h-4" /></p>
        <p>
          Class: {paper.gradeLevel.replace(/^class\s+/i, '')} Section:
          <span className="inline-block border-b border-zinc-400 w-24 ml-1 align-bottom h-4" />
        </p>
      </div>

      <div className="space-y-8">
        {paper.sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </div>

      <p className="text-[13px] font-bold text-zinc-900 mt-8">End of Question Paper</p>

      <AnswerKey paper={paper} />
    </article>
  );
}
