import { create } from 'zustand';
import type { QuestionPaper } from '@vedaai/shared';

export interface ProgressEvent {
  assignmentId: string;
  jobId?: string;
  status: string;
  progress: number;
  message?: string;
  paperId?: string;
}

interface PaperStore {
  papers: Record<string, QuestionPaper>;
  progress: Record<string, ProgressEvent>;
  isLoading: boolean;
  error: string | null;
  setPaper: (assignmentId: string, paper: QuestionPaper) => void;
  clearPaper: (assignmentId: string) => void;
  setProgress: (assignmentId: string, event: ProgressEvent) => void;
  clearProgress: (assignmentId: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const usePaperStore = create<PaperStore>((set) => ({
  papers: {},
  progress: {},
  isLoading: false,
  error: null,

  setPaper: (assignmentId, paper) =>
    set((state) => ({ papers: { ...state.papers, [assignmentId]: paper } })),

  clearPaper: (assignmentId) =>
    set((state) => {
      const papers = { ...state.papers };
      delete papers[assignmentId];
      return { papers };
    }),

  clearProgress: (assignmentId) =>
    set((state) => {
      const progress = { ...state.progress };
      delete progress[assignmentId];
      return { progress };
    }),

  setProgress: (assignmentId, event) =>
    set((state) => ({
      progress: { ...state.progress, [assignmentId]: event },
    })),

  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
}));
