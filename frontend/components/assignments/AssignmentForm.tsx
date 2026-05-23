'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDropzone } from 'react-dropzone';
import { QUESTION_TYPES, type QuestionType } from '@vedaai/shared';
import { createAssignment, suggestAssignmentName } from '@/lib/api';
import { simulateGeneration } from '@/lib/mock';
import { usePaperStore } from '@/store/paper.store';
import { getSocket } from '@/lib/socket';
import {
  UploadCloud,
  CalendarPlus,
  X,
  ChevronDown,
  Mic,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react';

const SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Science',
  'English', 'Hindi', 'History', 'Geography', 'Civics',
  'Economics', 'Computer Science', 'Environmental Studies', 'General Knowledge',
];

const CLASSES = [
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6',
  'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12',
];

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple Choice Questions',
  short_answer: 'Short Questions',
  long_answer: 'Long Answer / Essay',
  fill_in_blank: 'Fill in the Blanks',
  true_false: 'True / False Questions',
  numerical: 'Numerical Problems',
  diagram: 'Diagram/Graph-Based Questions',
};

const getTomorrowDateString = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

const schema = z.object({
  title: z.string().max(120).optional(),
  subject: z.string().min(1, 'Subject is required'),
  gradeLevel: z.string().min(1, 'Class is required'),
  topic: z.string().max(150).optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  additionalInstructions: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface QuestionTypeRow {
  id: string;
  type: QuestionType;
  count: number;
  marks: number;
}

export default function AssignmentForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);

  // Warm the socket connection on form mount so by the time we navigate
  // to /paper/{id} the WebSocket handshake is already done — no extra round-trip.
  useEffect(() => {
    const s = getSocket();
    if (!s.connected) s.connect();
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const submitLock = useRef(false);

  // Initialize with the rows matching the design mock-up
  const [rows, setRows] = useState<QuestionTypeRow[]>([
    { id: '1', type: 'mcq', count: 10, marks: 1 },
    { id: '2', type: 'short_answer', count: 5, marks: 2 },
    { id: '3', type: 'long_answer', count: 5, marks: 5 },
    { id: '4', type: 'fill_in_blank', count: 5, marks: 3 },
  ]);

  const [suggesting, setSuggesting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      subject: 'Mathematics',
      gradeLevel: 'Class 10',
      topic: '',
      dueDate: getTomorrowDateString(),
      additionalInstructions: '',
    },
  });

  const subject = watch('subject');
  const gradeLevel = watch('gradeLevel');
  const topic = watch('topic');
  const title = watch('title');
  const dueDate = watch('dueDate');
  const additionalInstructions = watch('additionalInstructions');

  // Compute dynamic progress based on key fields
  const progressFields = [
    !!subject,
    !!gradeLevel,
    !!topic?.trim(),
    !!title?.trim(),
    !!dueDate,
    rows.length > 0,
    !!additionalInstructions?.trim(),
  ];
  const filledCount = progressFields.filter(Boolean).length;
  const progressPct = Math.round((filledCount / progressFields.length) * 100);

  const handleSuggestName = async () => {
    if (!subject || !gradeLevel) return;
    setSuggesting(true);
    try {
      const { title } = await suggestAssignmentName({
        subject,
        gradeLevel,
        topic: topic?.trim() || undefined,
        questionTypes: rows.map((r) => r.type),
      });
      setValue('title', title, { shouldValidate: true });
    } catch {
      // Silent: fallback to deterministic local naming
      const fallback = topic?.trim()
        ? `Test on ${topic.trim()}`
        : `${subject} - ${gradeLevel}`;
      setValue('title', fallback, { shouldValidate: true });
    } finally {
      setSuggesting(false);
    }
  };

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
    },
    maxFiles: 1,
  });

  const handleUpdateRow = (id: string, field: 'count' | 'marks', delta: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const val = r[field] + delta;
        return { ...r, [field]: Math.max(1, val) };
      })
    );
  };

  const handleRowTypeChange = (id: string, newType: QuestionType) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, type: newType } : r))
    );
  };

  const handleAddRow = () => {
    const existingTypes = rows.map((r) => r.type);
    const nextType = (QUESTION_TYPES.find((t) => !existingTypes.includes(t)) || 'mcq') as QuestionType;

    setRows((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        type: nextType,
        count: 5,
        marks: 1,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const totalQuestions = rows.reduce((sum, r) => sum + r.count, 0);
  const totalMarks = rows.reduce((sum, r) => sum + r.count * r.marks, 0);

  const onSubmit = async (values: FormValues) => {
    if (submitLock.current) return;
    if (rows.length === 0) {
      setServerError('Please add at least one question type.');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setServerError(null);

    // Resolve title: manual > AI suggestion > deterministic fallback
    let resolvedTitle = values.title?.trim();
    if (!resolvedTitle) {
      try {
        const { title } = await suggestAssignmentName({
          subject: values.subject,
          gradeLevel: values.gradeLevel,
          topic: values.topic?.trim() || undefined,
          questionTypes: rows.map((r) => r.type),
        });
        resolvedTitle = title;
      } catch {
        resolvedTitle = values.topic?.trim()
          ? `Test on ${values.topic.trim()}`
          : `${values.subject} - ${values.gradeLevel}`;
      }
    }

    try {
      const fd = new FormData();
      fd.append('title', resolvedTitle);
      fd.append('subject', values.subject);
      fd.append('gradeLevel', values.gradeLevel);
      if (values.topic?.trim()) fd.append('topic', values.topic.trim());
      fd.append('dueDate', values.dueDate);
      fd.append('questionTypes', JSON.stringify(rows.map((r) => r.type)));
      fd.append('totalQuestions', String(totalQuestions));
      fd.append('totalMarks', String(totalMarks));

      const metadata = { breakdown: rows.map((r) => ({ type: r.type, count: r.count, marks: r.marks })) };
      const finalInstructions = `${values.additionalInstructions || ''}\n\n__METADATA__:${JSON.stringify(metadata)}`;
      fd.append('additionalInstructions', finalInstructions);

      if (file) fd.append('pdf', file);

      const { assignment } = await createAssignment(fd);
      // Seed optimistic progress so the next page renders the overlay instantly,
      // without waiting for the first JOB_PROGRESS socket event.
      usePaperStore.getState().setProgress(assignment._id, {
        assignmentId: assignment._id,
        status: 'queued',
        progress: 0,
        message: 'Job submitted — waiting for worker…',
      });
      router.push(`/paper/${assignment._id}`);
    } catch {
      // Backend unavailable — run client-side simulation
      const mockId = crypto.randomUUID();
      simulateGeneration(mockId, rows, resolvedTitle);
      router.push(`/paper/${mockId}`);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Dynamic Progress Bar */}
      <div className="flex flex-col items-center gap-2 mb-2">
        <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-800 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-100 p-5 sm:p-8 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.03)] flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-800 tracking-tight">Assignment Details</h2>
          <p className="text-[13px] text-zinc-400 font-medium">Basic information about your assignment</p>
        </div>

        {/* File Drag & Drop Zone */}
        <div>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
              isDragActive
                ? 'border-zinc-800 bg-zinc-50'
                : 'border-zinc-200 hover:border-zinc-300 bg-white'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center border border-zinc-200 shadow-sm text-zinc-600">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-zinc-700 max-w-[280px] truncate">{file.name}</p>
                <p className="text-xs text-zinc-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="mt-2 text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center border border-zinc-100 shadow-sm text-zinc-500 mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-zinc-700">Choose a file or drag & drop it here</p>
                <p className="text-xs text-zinc-400 mt-1 font-medium">JPEG, PNG, PDF upto 10MB</p>
                <button
                  type="button"
                  className="mt-4 px-5 py-2 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 text-zinc-700 text-xs font-semibold rounded-full active:scale-95 transition-all shadow-sm"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>
          <span className="text-[11px] text-zinc-400 font-medium text-center block mt-2">
            Upload images of your preferred document/image
          </span>
        </div>

        {/* Subject + Class row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-zinc-700">Subject</label>
            <div className="relative">
              <select
                {...register('subject')}
                className="w-full bg-[#f9fafb] border border-zinc-200/80 rounded-xl pl-4 pr-10 py-3 text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-800 transition-all appearance-none cursor-pointer"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-zinc-400 stroke-[2.5]" />
            </div>
            {errors.subject && <p className="text-xs text-red-500 font-semibold">{errors.subject.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-zinc-700">Class</label>
            <div className="relative">
              <select
                {...register('gradeLevel')}
                className="w-full bg-[#f9fafb] border border-zinc-200/80 rounded-xl pl-4 pr-10 py-3 text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-800 transition-all appearance-none cursor-pointer"
              >
                {CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-zinc-400 stroke-[2.5]" />
            </div>
            {errors.gradeLevel && <p className="text-xs text-red-500 font-semibold">{errors.gradeLevel.message}</p>}
          </div>
        </div>

        {/* Topic input */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-zinc-700">
            Topic / Chapter <span className="font-medium text-zinc-400">(optional)</span>
          </label>
          <input
            type="text"
            {...register('topic')}
            placeholder="e.g. Photosynthesis, Algebraic Equations, French Revolution"
            className="w-full bg-[#f9fafb] border border-zinc-200/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 transition-all font-semibold text-zinc-800 placeholder:text-zinc-400 placeholder:font-medium"
          />
        </div>

        {/* Assignment Title + AI suggest */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-zinc-700">
              Assignment Name <span className="font-medium text-zinc-400">(leave blank to auto-generate)</span>
            </label>
            <button
              type="button"
              onClick={handleSuggestName}
              disabled={suggesting || !subject || !gradeLevel}
              className="flex items-center gap-1.5 text-[12px] font-bold text-orange-600 hover:text-orange-700 disabled:text-zinc-300 disabled:cursor-not-allowed transition-colors"
            >
              {suggesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {suggesting ? 'Generating…' : 'Suggest with AI'}
            </button>
          </div>
          <input
            type="text"
            {...register('title')}
            placeholder='e.g. "Quiz on Photosynthesis" — or click Suggest with AI'
            className="w-full bg-[#f9fafb] border border-zinc-200/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 transition-all font-semibold text-zinc-800 placeholder:text-zinc-400 placeholder:font-medium"
          />
        </div>

        {/* Due Date Input */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-zinc-700">Due Date</label>
          <div className="relative flex items-center">
            <input
              type="date"
              {...register('dueDate')}
              className="w-full bg-[#f9fafb] border border-zinc-200/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 transition-all font-semibold text-zinc-600 cursor-pointer select-none"
            />
            <CalendarPlus className="absolute right-4 text-zinc-400 w-5 h-5 pointer-events-none stroke-[2]" />
          </div>
          {errors.dueDate && <p className="text-xs text-red-500 font-semibold">{errors.dueDate.message}</p>}
        </div>

        {/* Question Type Rows */}
        <div className="flex flex-col gap-3 md:gap-4 mt-2">
          {/* Header titles (Desktop Only) */}
          <div className="hidden md:flex items-center text-xs font-bold text-zinc-400 tracking-wider px-1">
            <span className="flex-1">Question Type</span>
            <span className="w-[110px] text-center leading-tight">No. of Qs</span>
            <span className="w-[110px] text-center">Marks</span>
            <span className="w-8"></span>
          </div>

          {/* Dynamic rows */}
          <div className="flex flex-col gap-2.5 md:gap-3">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col md:flex-row md:items-center gap-3 bg-white md:bg-transparent rounded-2xl md:rounded-none p-3 md:p-0 shadow-[0_2px_10px_rgba(0,0,0,0.04)] md:shadow-none border border-zinc-100 md:border-transparent">
                {/* Select Type Dropdown and Close Button (Mobile Top Row) */}
                <div className="flex items-center justify-between w-full md:w-auto md:flex-1">
                  <div className="flex-1 min-w-[110px] relative">
                    <select
                      value={row.type}
                      onChange={(e) => handleRowTypeChange(row.id, e.target.value as QuestionType)}
                      className="w-full bg-transparent md:bg-[#f9fafb] md:border border-zinc-200/80 rounded-[10px] md:rounded-xl pl-1 md:pl-4 pr-6 md:pr-10 py-1 md:py-3 text-[13px] md:text-sm font-semibold text-zinc-800 focus:outline-none appearance-none cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {QUESTION_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-zinc-700 md:text-zinc-400 stroke-[2] md:stroke-[2.5]" />
                  </div>
                  
                  {/* Remove button (Mobile: Top Right) */}
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.id)}
                    className="md:hidden w-8 h-8 flex items-center justify-center text-zinc-700 hover:text-red-500 rounded-full transition-all active:scale-95 shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[2]" />
                  </button>
                </div>

                {/* Desktop/Mobile Inner Container for Steppers */}
                <div className="flex flex-row items-center gap-3 bg-[#f4f4f4] md:bg-transparent rounded-xl p-3 md:p-0 w-full md:w-auto justify-between md:justify-end">
                  
                  {/* Questions count stepper */}
                  <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-[110px] md:justify-center">
                    <span className="md:hidden text-[12px] font-medium text-zinc-800">No. of Questions</span>
                    <div className="flex items-center bg-white md:bg-[#f9fafb] md:border border-zinc-200/80 rounded-full p-1 md:p-1 shadow-sm w-full md:max-w-[90px] justify-between">
                      <button type="button" onClick={() => handleUpdateRow(row.id, 'count', -1)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-900 rounded-full font-bold active:scale-90 transition-all text-xs shrink-0">—</button>
                      <span className="w-8 text-center font-bold text-zinc-900 text-[13px] md:text-sm select-none">{row.count}</span>
                      <button type="button" onClick={() => handleUpdateRow(row.id, 'count', 1)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-900 rounded-full font-bold active:scale-90 transition-all text-xs shrink-0">+</button>
                    </div>
                  </div>

                  {/* Marks count stepper */}
                  <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-[110px] md:justify-center">
                    <span className="md:hidden text-[12px] font-medium text-zinc-800">Marks</span>
                    <div className="flex items-center bg-white md:bg-[#f9fafb] md:border border-zinc-200/80 rounded-full p-1 md:p-1 shadow-sm w-full md:max-w-[90px] justify-between">
                      <button type="button" onClick={() => handleUpdateRow(row.id, 'marks', -1)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-900 rounded-full font-bold active:scale-90 transition-all text-xs shrink-0">—</button>
                      <span className="w-8 text-center font-bold text-zinc-900 text-[13px] md:text-sm select-none">{row.marks}</span>
                      <button type="button" onClick={() => handleUpdateRow(row.id, 'marks', 1)} className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-900 rounded-full font-bold active:scale-90 transition-all text-xs shrink-0">+</button>
                    </div>
                  </div>
                </div>

                {/* Desktop Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveRow(row.id)}
                  className="hidden md:flex w-8 h-8 items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-90 shrink-0"
                  title="Remove row"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Row Button & Totals summary */}
          <div className="flex flex-col justify-between gap-4 mt-2 mb-2 w-full">
            <button
              type="button"
              onClick={handleAddRow}
              className="flex self-start items-center gap-2.5 py-1.5 text-zinc-800 hover:text-zinc-950 font-bold text-[13px] rounded-full transition-all active:scale-95 whitespace-nowrap"
            >
              <span className="w-8 h-8 flex items-center justify-center bg-[#2d2d2d] hover:bg-black text-white rounded-full text-[16px] font-semibold leading-none shadow-sm shrink-0">
                +
              </span>
              Add Question Type
            </button>

            {/* Right Totals Box */}
            <div className="flex flex-col items-end gap-1.5 text-[14px] font-semibold text-zinc-700 w-full mt-2">
              <span className="whitespace-nowrap">
                Total Questions : <span className="font-bold text-zinc-900">{totalQuestions}</span>
              </span>
              <span className="whitespace-nowrap">
                Total Marks : <span className="font-bold text-zinc-900">{totalMarks}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Additional instructions text area */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-bold text-zinc-700">Additional Information (For better output)</label>
          <div className="relative">
            <textarea
              {...register('additionalInstructions')}
              rows={3}
              placeholder="e.g Generate a question paper for 3 hour exam duration.."
              className="w-full bg-[#f9fafb] border-2 border-dashed border-zinc-200/80 rounded-2xl p-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 transition-all font-medium text-zinc-600 resize-none min-h-[100px]"
            />
            <button
              type="button"
              className="absolute right-3.5 bottom-3.5 w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 rounded-full text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 transition-all shadow-sm active:scale-95"
              title="Voice input"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Local/Server Errors */}
        {serverError && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{serverError}</span>
          </div>
        )}
      </div>

      {/* Navigation Capsule Bar */}
      <div className="flex items-center justify-between mt-6 px-1 pb-24 md:pb-0">
        <button
          type="button"
          onClick={() => router.push('/assignments')}
          className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 text-zinc-700 text-[13px] sm:text-sm font-bold rounded-full transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500" />
          Previous
        </button>

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-zinc-950 hover:bg-black disabled:bg-zinc-400 disabled:cursor-not-allowed text-white text-[13px] sm:text-sm font-bold rounded-full transition-all active:scale-95 shadow-md"
        >
          {submitting ? 'Generating…' : 'Generate Paper'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
