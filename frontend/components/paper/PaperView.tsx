'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuestionPaper, PdfReadyEvent, PdfFailedEvent } from '@vedaai/shared';
import type { Assignment } from '@vedaai/shared';
import { SOCKET_EVENTS } from '@vedaai/shared';
import SectionBlock from './SectionBlock';
import AnswerKey from './AnswerKey';
import { requestPdfExport, pdfDownloadUrl } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { PROFILE } from '@/lib/profile';
import { RefreshCw, Download, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  paper: QuestionPaper;
  assignmentId: string;
  assignment?: Assignment | null;
  onRegenerate: () => void;
}

type PdfState =
  | { kind: 'idle' }
  | { kind: 'queued' }
  | { kind: 'failed'; message: string };

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ',
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  true_false: 'True/False',
  fill_in_blank: 'Fill in the Blank',
  numerical: 'Numerical',
  diagram: 'Diagram',
};

export default function PaperView({ paper, assignmentId, assignment, onRegenerate }: Props) {
  const [regenerating, setRegenerating] = useState(false);
  const [pdfState, setPdfState] = useState<PdfState>({ kind: 'idle' });
  const pdfStateRef = useRef<PdfState>(pdfState);
  pdfStateRef.current = pdfState;

  const handleRegenerate = () => {
    setRegenerating(true);
    onRegenerate();
  };

  // Listen for queued-PDF events. Room is already joined by PaperPageClient on mount.
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onReady = (evt: PdfReadyEvent) => {
      if (evt.assignmentId !== assignmentId) return;
      if (pdfStateRef.current.kind !== 'queued') return;
      setPdfState({ kind: 'idle' });
      // Open download URL in a new tab — browser handles file save
      window.open(pdfDownloadUrl(evt.downloadPath), '_blank', 'noopener');
    };
    const onFailed = (evt: PdfFailedEvent) => {
      if (evt.assignmentId !== assignmentId) return;
      setPdfState({ kind: 'failed', message: evt.error });
    };

    socket.on(SOCKET_EVENTS.PDF_READY, onReady);
    socket.on(SOCKET_EVENTS.PDF_FAILED, onFailed);
    return () => {
      socket.off(SOCKET_EVENTS.PDF_READY, onReady);
      socket.off(SOCKET_EVENTS.PDF_FAILED, onFailed);
    };
  }, [assignmentId]);

  const handleExportPdf = async () => {
    if (pdfState.kind === 'queued') return;
    setPdfState({ kind: 'queued' });
    try {
      const result = await requestPdfExport(assignmentId);
      if (result.status === 'ready') {
        // Already cached — download immediately, skip waiting on socket
        setPdfState({ kind: 'idle' });
        window.open(pdfDownloadUrl(result.downloadPath), '_blank', 'noopener');
      }
      // status === 'queued' — wait for PDF_READY socket event
    } catch (err) {
      setPdfState({
        kind: 'failed',
        message: err instanceof Error ? err.message : 'Failed to start PDF export',
      });
    }
  };

  const exporting = pdfState.kind === 'queued';

  const schoolName = paper.schoolName ?? PROFILE.schoolFullName;
  const instructions = paper.instructions ?? [
    'All questions are compulsory unless stated otherwise.',
  ];

  return (
    <div className="min-h-screen px-2 sm:px-4 md:px-6 py-4 sm:py-6 pb-28 md:pb-6 print:px-0 print:py-0 m-2 md:m-4 rounded-3xl print:m-0 print:rounded-none" style={{ background: '#CECECE' }}>


      {/* Action Banner */}
      <div className="bg-[#2d2d2d] text-white rounded-3xl p-6 sm:p-8 mb-6 print:hidden shadow-md">
        <h2 className="text-[16px] sm:text-[18px] font-semibold leading-relaxed mb-5">
          Here is your customized Question Paper for{' '}
          <span className="font-extrabold">{paper.gradeLevel}</span>{' '}—{' '}
          <span className="font-extrabold">{paper.subject}</span>
          {assignment?.topic ? (
            <>, <span className="font-extrabold">{assignment.topic}</span></>
          ) : null}.
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-2 bg-white text-zinc-900 px-4 sm:px-5 py-2.5 rounded-full text-[14px] font-bold transition-all hover:bg-zinc-100 active:scale-95 shadow-sm disabled:opacity-70 disabled:cursor-wait"
          >
            {exporting ? (
              <Loader2 className="w-[18px] h-[18px] animate-spin shrink-0" />
            ) : (
              <Download className="w-[18px] h-[18px] shrink-0" />
            )}
            <span className="hidden sm:inline">{exporting ? 'Preparing…' : 'Download as PDF'}</span>
          </button>
          
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 bg-transparent text-white hover:bg-white/10 border border-white/30 px-4 sm:px-5 py-2.5 rounded-full text-[14px] font-bold transition-all active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`w-[18px] h-[18px] shrink-0 ${regenerating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{regenerating ? 'Regenerating…' : 'Regenerate'}</span>
          </button>
        </div>
      </div>

      {pdfState.kind === 'failed' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-4 text-[13px] font-semibold print:hidden">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">PDF export failed: {pdfState.message}</span>
        </div>
      )}

      {/* Paper sheet */}
      <article className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200 px-5 sm:px-8 md:px-12 py-6 sm:py-8 md:py-10 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.25)] print:shadow-none print:border-0 print:rounded-none print:p-0">
        {/* School Header */}
        <header className="text-center mb-4">
          <h1 className="text-[17px] sm:text-[20px] md:text-[22px] font-bold text-zinc-900 tracking-tight leading-tight">
            {schoolName}
          </h1>
          <p className="text-[13px] sm:text-[15px] text-zinc-700 mt-1.5 font-semibold">Subject: {paper.subject}</p>
          <p className="text-[13px] sm:text-[15px] text-zinc-700 font-semibold">Class: {paper.gradeLevel}</p>
        </header>

        {/* Time / Marks bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 border-t border-zinc-200 pt-3 sm:pt-4 mb-4">
          <span className="text-[12px] sm:text-[13px] font-semibold text-zinc-700">
            Time Allowed: <span className="text-zinc-900">{paper.duration ?? '45 minutes'}</span>
          </span>
          <span className="text-[12px] sm:text-[13px] font-semibold text-zinc-700">
            Maximum Marks: <span className="text-zinc-900">{paper.totalMarks}</span>
          </span>
        </div>

        {/* Instructions */}
        <div className="mb-6">
          {instructions.map((line, i) => (
            <p key={i} className="text-[13px] text-zinc-700 font-semibold leading-relaxed">
              {line}
            </p>
          ))}
        </div>

        {/* Student fields */}
        <div className="mb-6 sm:mb-8 text-[12px] sm:text-[13px] text-zinc-800 font-semibold space-y-2">
          <p>
            Name: <span className="inline-block border-b border-zinc-400 w-32 sm:w-56 ml-1 align-bottom h-4" />
          </p>
          <p>
            Roll Number: <span className="inline-block border-b border-zinc-400 w-24 sm:w-40 ml-1 align-bottom h-4" />
          </p>
          <p>
            Class: {paper.gradeLevel} Section:
            <span className="inline-block border-b border-zinc-400 w-16 sm:w-24 ml-1 align-bottom h-4" />
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {paper.sections.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}
        </div>

        {/* End marker */}
        <p className="text-[13px] font-bold text-zinc-900 mt-8">End of Question Paper</p>

        {/* Answer Key */}
        <AnswerKey paper={paper} />
      </article>
    </div>
  );
}
