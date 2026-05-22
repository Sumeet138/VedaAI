export type JobProgressStatus =
  | 'queued'
  | 'extracting'
  | 'prompting'
  | 'generating'
  | 'parsing'
  | 'saving'
  | 'completed'
  | 'failed';

export interface JobProgressEvent {
  assignmentId: string;
  jobId: string;
  status: JobProgressStatus;
  progress: number;
  message: string;
  paperId?: string;
  error?: string;
}

export interface PdfReadyEvent {
  assignmentId: string;
  version: number;
  /** Server-relative download URL — frontend prefixes with API base */
  downloadPath: string;
  cached: boolean;
}

export interface PdfFailedEvent {
  assignmentId: string;
  error: string;
}

export const SOCKET_EVENTS = {
  JOIN_ROOM: 'join:room',
  LEAVE_ROOM: 'leave:room',
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETED: 'job:completed',
  JOB_FAILED: 'job:failed',
  PDF_READY: 'pdf:ready',
  PDF_FAILED: 'pdf:failed',
} as const;
