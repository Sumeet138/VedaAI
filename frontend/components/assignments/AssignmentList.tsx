'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  ChevronDown,
  Loader2,
  Trash2,
  Eye,
  X,
  ArrowLeft,
} from 'lucide-react';
import { useAssignmentStore } from '@/store/assignment.store';
import { listAssignments, deleteAssignment } from '@/lib/api';
import type { Assignment } from '@vedaai/shared';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  processing: 'Generating',
  completed: 'Ready',
  failed: 'Failed',
};

// Left-edge rail color per status — communicates state at a glance without text
const STATUS_RAIL: Record<string, string> = {
  pending: 'bg-zinc-200',
  processing: 'bg-blue-500',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
};

// Text color for the inline status pill in the eyebrow
const STATUS_TEXT: Record<string, string> = {
  pending: 'text-zinc-500',
  processing: 'text-blue-600',
  completed: 'text-emerald-600',
  failed: 'text-red-600',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Empty state illustration (kept from original)
const EmptyStateIllustration = () => (
  <div className="relative w-80 h-72 flex items-center justify-center select-none mb-6">
    <div className="absolute w-56 h-56 bg-[#e6e8ee]/70 rounded-full z-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.015)]" />
    <svg className="absolute inset-0 w-full h-full z-0 overflow-visible pointer-events-none" viewBox="0 0 320 288">
      <path
        d="M 95,115 C 65,95 70,55 105,65 C 145,75 125,145 75,130"
        fill="none"
        stroke="#27272a"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="opacity-95"
      />
      <circle cx="218" cy="142" r="4" fill="#3b82f6" />
      <path
        d="M 124 206 L 127 212 L 133 214 L 127 216 L 124 222 L 121 216 L 115 214 L 121 212 Z"
        fill="#3b82f6"
        className="opacity-90"
      />
    </svg>
    <div className="absolute w-12 h-8 bg-white border border-zinc-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] rounded-lg top-16 right-16 z-0 flex flex-col p-1.5 gap-1.5 rotate-[15deg]">
      <div className="h-1 w-4 bg-zinc-400 rounded-full" />
      <div className="h-0.8 w-7 bg-zinc-200 rounded-full" />
      <div className="h-0.8 w-5 bg-zinc-200 rounded-full" />
    </div>
    <div className="absolute w-[120px] h-[160px] bg-white border border-zinc-200/90 shadow-[0_8px_24px_rgba(0,0,0,0.04)] rounded-xl p-3.5 -rotate-6 z-10 -translate-x-6 -translate-y-2 flex flex-col justify-start">
      <div className="h-2.5 w-10 bg-zinc-800 rounded-full mb-3" />
      <div className="h-1.5 w-full bg-zinc-100 rounded-full mb-2" />
      <div className="h-1.5 w-4/5 bg-zinc-100 rounded-full mb-2" />
      <div className="h-1.5 w-5/6 bg-zinc-100 rounded-full mb-2" />
      <div className="h-1.5 w-2/3 bg-zinc-100 rounded-full" />
    </div>
  </div>
);

interface CardProps {
  assignment: Assignment;
  onDelete: (id: string) => void;
}

const TYPE_TAG: Record<string, string> = {
  mcq: 'MCQ',
  short_answer: 'Short',
  long_answer: 'Long',
  true_false: 'T/F',
  fill_in_blank: 'Fill',
  numerical: 'Numerical',
  diagram: 'Diagram',
};


function AssignmentCard({ assignment, onDelete }: CardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // De-dupe types while preserving order; show max 4, collapse rest into "+N"
  const uniqueTypes = Array.from(new Set(assignment.questionTypes));
  const visibleTypes = uniqueTypes.slice(0, 4);
  const overflowCount = uniqueTypes.length - visibleTypes.length;
  const showStatus = assignment.status !== 'completed';

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const handleView = () => {
    setMenuOpen(false);
    router.push(`/paper/${assignment._id}`);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    onDelete(assignment._id);
  };

  const railColor = STATUS_RAIL[assignment.status] ?? STATUS_RAIL.pending;
  const statusText = STATUS_TEXT[assignment.status] ?? STATUS_TEXT.pending;
  const isProcessing = assignment.status === 'processing';

  return (
    <div className="group relative bg-white rounded-[20px] border border-zinc-200/50 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18)] hover:-translate-y-1 hover:border-zinc-300/80 transition-all duration-300 overflow-hidden flex flex-col min-h-[210px]">
      {/* Top shimmer when generating — academic-paper-on-press feel */}
      {isProcessing && (
        <span
          aria-hidden
          className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse"
        />
      )}

      <div className="flex flex-col gap-3.5 p-6 pb-5 flex-1">
        {/* Header row: eyebrow + title (left) — kebab menu (right) */}
        <div className="flex items-start justify-between gap-3">
          <Link href={`/paper/${assignment._id}`} className="flex-1 min-w-0 group/title">
            {/* Eyebrow: SUBJECT · CLASS · STATUS — magazine kicker */}
            <div className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.14em] uppercase text-zinc-500 mb-2">
              <span className="truncate">{assignment.subject}</span>
              <span className="w-[3px] h-[3px] rounded-full bg-zinc-300 shrink-0" />
              <span className="truncate">{assignment.gradeLevel}</span>
              {showStatus && (
                <>
                  <span className="w-[3px] h-[3px] rounded-full bg-zinc-300 shrink-0" />
                  <span className={`${statusText} shrink-0`}>
                    {STATUS_LABEL[assignment.status] ?? assignment.status}
                  </span>
                </>
              )}
            </div>

            {/* Title — display weight, tight tracking */}
            <h3 className="text-[19px] md:text-[23px] font-extrabold text-zinc-900 tracking-[-0.02em] leading-[1.15] group-hover/title:text-zinc-700 transition-colors line-clamp-2">
              {assignment.title}
            </h3>
          </Link>

          <div className="relative shrink-0 -mt-1 -mr-1" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setMenuOpen((v) => !v); }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-900"
              aria-label="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-zinc-100 z-20 p-1.5 font-medium flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleView(); }}
                  className="w-full text-left px-3 py-2 text-[13px] text-zinc-700 hover:text-black hover:bg-zinc-100 rounded-[10px] transition-all"
                >
                  View Assignment
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleDelete(); }}
                  className="w-full text-left px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 rounded-[10px] transition-all"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Question type tags — micro-caps, borderless, tight */}
        {visibleTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleTypes.map((t) => (
              <span
                key={t}
                className="text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded-md bg-zinc-100 text-zinc-700"
              >
                {TYPE_TAG[t] ?? t}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="text-[9px] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded-md bg-zinc-50 text-zinc-400">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* Footer — stats on the left, due date on the right, divider above */}
        <div className="flex items-end justify-between mt-auto pt-3 border-t border-zinc-100">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-zinc-400">Questions</span>
            <span className="text-[13px] font-bold text-zinc-900 tabular-nums">
              {assignment.totalQuestions}
              <span className="text-zinc-300 mx-1">·</span>
              <span className="text-zinc-600">{assignment.totalMarks}m</span>
            </span>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-zinc-400">Due</span>
            <span className="text-[13px] font-bold text-zinc-900 tabular-nums">
              {formatDate(assignment.dueDate)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FilterPopoverProps {
  subjects: string[];
  classes: string[];
  filterSubject: string | null;
  filterClass: string | null;
  filterStatus: string | null;
  setFilterSubject: (v: string | null) => void;
  setFilterClass: (v: string | null) => void;
  setFilterStatus: (v: string | null) => void;
  onClose: () => void;
}

function FilterPopover({
  subjects,
  classes,
  filterSubject,
  filterClass,
  filterStatus,
  setFilterSubject,
  setFilterClass,
  setFilterStatus,
  onClose,
}: FilterPopoverProps) {
  const activeCount =
    (filterSubject ? 1 : 0) + (filterClass ? 1 : 0) + (filterStatus ? 1 : 0);

  return (
    <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-zinc-100 p-5 z-20">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-zinc-900">Filter</h4>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setFilterSubject(null);
              setFilterClass(null);
              setFilterStatus(null);
            }}
            className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        <div>
          <label className="block text-[11px] font-bold text-zinc-500 mb-1.5 tracking-wider uppercase">
            Subject
          </label>
          <div className="relative">
            <select
              value={filterSubject ?? ''}
              onChange={(e) => setFilterSubject(e.target.value || null)}
              className="w-full bg-[#f9fafb] border border-zinc-200 rounded-lg pl-3 pr-9 py-2 text-[13px] font-semibold text-zinc-800 appearance-none cursor-pointer focus:outline-none"
            >
              <option value="">All</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-zinc-400" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-zinc-500 mb-1.5 tracking-wider uppercase">
            Class
          </label>
          <div className="relative">
            <select
              value={filterClass ?? ''}
              onChange={(e) => setFilterClass(e.target.value || null)}
              className="w-full bg-[#f9fafb] border border-zinc-200 rounded-lg pl-3 pr-9 py-2 text-[13px] font-semibold text-zinc-800 appearance-none cursor-pointer focus:outline-none"
            >
              <option value="">All</option>
              {classes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-zinc-400" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-zinc-500 mb-1.5 tracking-wider uppercase">
            Status
          </label>
          <div className="relative">
            <select
              value={filterStatus ?? ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="w-full bg-[#f9fafb] border border-zinc-200 rounded-lg pl-3 pr-9 py-2 text-[13px] font-semibold text-zinc-800 appearance-none cursor-pointer focus:outline-none"
            >
              <option value="">All</option>
              <option value="completed">Ready</option>
              <option value="processing">Generating</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-zinc-400" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-900"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function AssignmentList() {
  const { assignments, isLoading, error, setAssignments, setLoading, setError, remove } =
    useAssignmentStore();

  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Only show skeleton on the FIRST load. After that, refresh in the background
    // so navigating between tabs feels instant when data is already in the store.
    const isFirstLoad = assignments.length === 0;
    if (isFirstLoad) setLoading(true);
    listAssignments()
      .then(({ assignments }) => setAssignments(assignments))
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        if (isFirstLoad) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAssignments, setLoading, setError]);

  useEffect(() => {
    if (!filterOpen) return;
    const onClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [filterOpen]);

  const subjects = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.subject))).sort(),
    [assignments],
  );
  const classes = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.gradeLevel))).sort(),
    [assignments],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((a) => {
      if (filterSubject && a.subject !== filterSubject) return false;
      if (filterClass && a.gradeLevel !== filterClass) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (q && !a.title.toLowerCase().includes(q) && !(a.topic ?? '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [assignments, search, filterSubject, filterClass, filterStatus]);

  const activeFilterCount =
    (filterSubject ? 1 : 0) + (filterClass ? 1 : 0) + (filterStatus ? 1 : 0);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteAssignment(id);
      remove(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 w-full px-4 md:px-8 mt-6">
        <div className="h-8 w-48 bg-zinc-200 rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white border border-zinc-200 animate-pulse p-5" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-red-500 max-w-md mx-auto">
        <p className="font-semibold mb-2">Failed to load assignments</p>
        <p className="text-sm text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh] text-center select-none max-w-lg mx-auto pb-10">
        <EmptyStateIllustration />
        <h2 className="text-xl font-bold text-zinc-800 mb-2">No assignments yet</h2>
        <p className="text-zinc-500 text-[14.5px] leading-relaxed max-w-[430px] mb-6">
          Create your first assignment to start collecting and grading student submissions.
          You can set up rubrics, define marking criteria, and let AI assist with grading.
        </p>
        <Link
          href="/assignments/create"
          className="flex items-center gap-1.5 bg-[#18181b] hover:bg-[#27272a] active:scale-[0.98] text-white py-3 px-6 rounded-full font-semibold text-[15px] transition-all shadow-sm hover:shadow"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>Create Your First Assignment</span>
        </Link>
      </div>
    );
  }

  const confirmTarget = confirmDeleteId
    ? assignments.find((a) => a._id === confirmDeleteId)
    : null;

  return (
    <div className="w-full px-4 md:px-8 py-4 md:py-6 pb-32 relative">
      {/* Page Header */}
      <div className="mb-6">
        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#10b981]" />
            <h1 className="text-xl font-bold text-zinc-800 tracking-tight">Assignments</h1>
          </div>
          <p className="text-[13px] text-zinc-500 font-medium ml-5">
            Manage and create assignments for your classes
          </p>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center relative py-1">
          <Link href="/" className="w-[42px] h-[42px] flex items-center justify-center bg-[#E8E8E8] hover:bg-[#dcdcdc] rounded-full shrink-0 transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-800 stroke-[2.5]" />
          </Link>
          <h1 className="flex-1 text-center text-[18px] font-bold text-zinc-800 pr-[42px]">Assignments</h1>
        </div>
      </div>

      {/* Filter + search bar */}
      <div className="bg-white rounded-[24px] border border-zinc-100 pl-5 pr-1.5 py-1.5 md:py-2 mb-8 flex items-center justify-between gap-4 shadow-sm w-full">
        <div className="relative shrink-0" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-2 text-[14px] font-medium text-zinc-400 hover:text-zinc-800 transition-colors"
          >
            <Filter className="w-4 h-4 stroke-[2]" />
            <span className="md:hidden">Filter</span>
            <span className="hidden md:inline">Filter By</span>
            {activeFilterCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center ml-1">
                {activeFilterCount}
              </span>
            )}
          </button>
          {filterOpen && (
            <FilterPopover
              subjects={subjects}
              classes={classes}
              filterSubject={filterSubject}
              filterClass={filterClass}
              filterStatus={filterStatus}
              setFilterSubject={setFilterSubject}
              setFilterClass={setFilterClass}
              setFilterStatus={setFilterStatus}
              onClose={() => setFilterOpen(false)}
            />
          )}
        </div>

        <div className="flex-1 md:max-w-[320px] relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 stroke-[2]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Assignment"
            className="w-full bg-white border border-zinc-200/80 rounded-[20px] pl-10 pr-4 py-2 text-[13px] font-medium text-zinc-800 placeholder:text-zinc-400 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 text-sm font-medium">
          No assignments match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((a) => (
            <AssignmentCard
              key={a._id}
              assignment={a}
              onDelete={(id) => setConfirmDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* Bottom gradient fade */}
      <div className="hidden md:block fixed bottom-0 left-[260px] right-0 h-40 bg-gradient-to-t from-[#f3f3f3] via-[#f3f3f3]/80 to-transparent pointer-events-none z-0" />

      {/* Floating Create button (Desktop) */}
      <div className="hidden md:flex fixed bottom-8 left-[260px] right-0 justify-center pointer-events-none z-10">
        <Link
          href="/assignments/create"
          className="pointer-events-auto flex items-center gap-2 bg-[#222] hover:bg-black active:scale-[0.98] text-white px-5 py-3 rounded-full font-medium text-[14px] shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Create Assignment</span>
        </Link>
      </div>

      {/* Floating Create button (Mobile) */}
      <div className="md:hidden fixed bottom-[110px] right-5 z-20 pointer-events-none">
        <Link
          href="/assignments/create"
          className="pointer-events-auto flex items-center justify-center w-14 h-14 bg-white rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] text-[#ff5722] hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-7 h-7 stroke-[2]" />
        </Link>
      </div>

      {/* Delete confirm dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 text-center mb-1">Delete assignment?</h3>
            <p className="text-sm text-zinc-500 text-center mb-6">
              <span className="font-semibold text-zinc-700">{confirmTarget.title}</span> will be
              permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting === confirmTarget._id}
                className="flex-1 border border-zinc-200 hover:border-zinc-300 text-zinc-700 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmTarget._id)}
                disabled={deleting === confirmTarget._id}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {deleting === confirmTarget._id && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
