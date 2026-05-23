'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';
import { usePaperStore } from '@/store/paper.store';
import { getPaper, regeneratePaper, getAssignment } from '@/lib/api';
import type { Assignment } from '@vedaai/shared';
import GenerationOverlay from './GenerationOverlay';
import PaperView from './PaperView';

interface Props {
  assignmentId: string;
}

export default function PaperPageClient({ assignmentId }: Props) {
  useSocket(assignmentId);

  const paper = usePaperStore((s) => s.papers[assignmentId]);
  const progress = usePaperStore((s) => s.progress[assignmentId]);
  const { setPaper, clearPaper, clearProgress } = usePaperStore();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assignmentLoaded, setAssignmentLoaded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch paper on mount (silent on 404 — still being generated)
  useEffect(() => {
    if (!paper) {
      getPaper(assignmentId)
        .then(({ paper }) => setPaper(assignmentId, paper))
        .catch(() => {});
    }
  }, [assignmentId, paper, setPaper]);

  // Fetch assignment metadata so we can detect stuck/old jobs
  useEffect(() => {
    getAssignment(assignmentId)
      .then(({ assignment }) => setAssignment(assignment))
      .catch(() => setAssignment(null))
      .finally(() => setAssignmentLoaded(true));
  }, [assignmentId]);

  // Poll while generating — catches missed socket events (navigation, reconnect).
  // Stops as soon as paper lands or assignment reaches a terminal state.
  useEffect(() => {
    if (paper) return;

    const poll = async () => {
      try {
        const { assignment: a } = await getAssignment(assignmentId);
        setAssignment(a);
        if (a.status === 'completed') {
          const { paper: p } = await getPaper(assignmentId);
          setPaper(assignmentId, p);
        }
      } catch {
        // silent — socket is still the primary path
      }
    };

    const id = setInterval(poll, 8_000);
    return () => clearInterval(id);
  }, [assignmentId, paper, setPaper]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setActionError(null);
    clearPaper(assignmentId);
    clearProgress(assignmentId);
    try {
      await regeneratePaper(assignmentId);
    } catch (e) {
      setRegenerating(false);
      setActionError(e instanceof Error ? e.message : 'Could not start regeneration');
    }
  };

  const isFailed = progress?.status === 'failed' && !paper;
  const hasLiveProgress =
    !!progress &&
    progress.status !== 'failed' &&
    progress.progress < 100;

  // Treat freshly-created assignments as "still generating" even before socket events arrive.
  // 90s window covers normal Gemini latency + initial queue pickup.
  const assignmentIsFresh =
    !!assignment &&
    (assignment.status === 'pending' || assignment.status === 'processing') &&
    Date.now() - new Date(assignment.updatedAt).getTime() < 300_000;

  const isGenerating =
    !paper && !isFailed && (regenerating || hasLiveProgress || assignmentIsFresh);

  // Failure UI (live failure event from socket)
  if (isFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-10 w-full max-w-md text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Generation Failed</h2>
          <p className="text-sm text-gray-500 mb-6">
            {progress?.message ?? 'Something went wrong while generating your paper.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRegenerate}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/assignments"
              className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <GenerationOverlay
        progress={progress?.progress ?? 0}
        message={progress?.message ?? 'Waiting for job to start…'}
        status={progress?.status ?? 'queued'}
      />
    );
  }

  // Paper available — render
  if (paper) {
    return (
      <PaperView
        paper={paper}
        assignmentId={assignmentId}
        assignment={assignment}
        onRegenerate={handleRegenerate}
      />
    );
  }

  // No paper, no live progress. Optimistically show the overlay while we
  // resolve the assignment — avoids a blank flash on page transitions.
  if (!assignmentLoaded) {
    return (
      <GenerationOverlay
        progress={0}
        message="Connecting…"
        status="queued"
      />
    );
  }

  // Assignment doesn't exist — bad URL or deleted
  if (!assignment) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h2 className="text-lg font-bold text-zinc-800 mb-2">Assignment not found</h2>
        <p className="text-sm text-zinc-500 mb-6">
          This assignment does not exist or has been deleted.
        </p>
        <Link
          href="/assignments"
          className="inline-block bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-black transition-colors"
        >
          Back to Assignments
        </Link>
      </div>
    );
  }

  // Assignment exists but no paper — stuck job (worker died, status stale, etc.)
  const wasStuck = assignment.status === 'pending' || assignment.status === 'processing';
  const wasFailed = assignment.status === 'failed';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 p-10 w-full max-w-md text-center">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${
          wasFailed ? 'bg-red-100' : 'bg-amber-100'
        }`}>
          <svg className={`w-7 h-7 ${wasFailed ? 'text-red-500' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">
          {wasFailed ? 'Generation Failed' : wasStuck ? 'Generation Interrupted' : 'Paper Not Available'}
        </h2>
        <p className="text-sm text-zinc-500 mb-2">
          {wasFailed
            ? assignment.errorMessage ?? 'The previous attempt failed.'
            : wasStuck
            ? 'The previous generation never finished — likely the server restarted mid-job.'
            : 'No paper exists for this assignment yet.'}
        </p>
        <p className="text-xs text-zinc-400 mb-6">
          Status: <span className="font-mono">{assignment.status}</span>
        </p>
        {actionError && (
          <p className="text-xs text-red-500 font-semibold mb-4">{actionError}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
          >
            {regenerating ? 'Starting…' : 'Regenerate Paper'}
          </button>
          <Link
            href="/assignments"
            className="border border-zinc-300 text-zinc-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-zinc-50 transition-colors"
          >
            Back to List
          </Link>
        </div>
      </div>
    </div>
  );
}
