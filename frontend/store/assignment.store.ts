import { create } from 'zustand';
import type { Assignment } from '@vedaai/shared';

interface AssignmentStore {
  assignments: Assignment[];
  current: Assignment | null;
  isLoading: boolean;
  error: string | null;
  setAssignments: (list: Assignment[]) => void;
  setCurrent: (a: Assignment | null) => void;
  upsert: (a: Assignment) => void;
  remove: (id: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useAssignmentStore = create<AssignmentStore>((set) => ({
  assignments: [],
  current: null,
  isLoading: false,
  error: null,

  setAssignments: (list) => set({ assignments: list }),
  setCurrent: (a) => set({ current: a }),
  upsert: (a) =>
    set((state) => {
      const idx = state.assignments.findIndex((x) => x._id === a._id);
      const assignments =
        idx === -1
          ? [...state.assignments, a]
          : state.assignments.map((x) => (x._id === a._id ? a : x));
      const current = state.current?._id === a._id ? a : state.current;
      return { assignments, current };
    }),
  remove: (id) =>
    set((state) => ({
      assignments: state.assignments.filter((a) => a._id !== id),
      current: state.current?._id === id ? null : state.current,
    })),
  setLoading: (v) => set({ isLoading: v }),
  setError: (e) => set({ error: e }),
}));
