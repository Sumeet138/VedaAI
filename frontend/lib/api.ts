import axios from 'axios';
import type {
  ApiResponse,
  CreateAssignmentResponse,
  GetPaperResponse,
  ListAssignmentsResponse,
} from '@vedaai/shared';

const headers: Record<string, string> = { 'Content-Type': 'application/json' };
if (process.env.NEXT_PUBLIC_API_KEY) {
  headers['x-api-key'] = process.env.NEXT_PUBLIC_API_KEY;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  headers,
});

export async function suggestAssignmentName(input: {
  subject: string;
  gradeLevel: string;
  topic?: string;
  questionTypes: string[];
}): Promise<{ title: string }> {
  const res = await api.post<ApiResponse<{ title: string }>>(
    '/assignments/suggest-name',
    input,
  );
  if (!res.data.data) throw new Error(res.data.error ?? 'Failed to suggest title');
  return res.data.data;
}

export async function deleteAssignment(id: string): Promise<void> {
  await api.delete(`/assignments/${id}`);
}

export async function createAssignment(
  formData: FormData,
): Promise<CreateAssignmentResponse> {
  const res = await api.post<ApiResponse<CreateAssignmentResponse>>(
    '/assignments',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  if (!res.data.data) throw new Error(res.data.error ?? 'Unknown error');
  return res.data.data;
}

export async function listAssignments(): Promise<ListAssignmentsResponse> {
  const res = await api.get<ApiResponse<ListAssignmentsResponse>>('/assignments');
  if (!res.data.data) throw new Error(res.data.error ?? 'Unknown error');
  return res.data.data;
}

export async function getAssignment(id: string) {
  const res = await api.get<ApiResponse<{ assignment: import('@vedaai/shared').Assignment }>>(
    `/assignments/${id}`,
  );
  if (!res.data.data) throw new Error(res.data.error ?? 'Unknown error');
  return res.data.data;
}

export async function getPaper(assignmentId: string): Promise<GetPaperResponse> {
  const res = await api.get<ApiResponse<GetPaperResponse>>(
    `/papers/${assignmentId}`,
  );
  if (!res.data.data) throw new Error(res.data.error ?? 'Unknown error');
  return res.data.data;
}

export async function regeneratePaper(
  assignmentId: string,
  body?: { additionalInstructions?: string },
): Promise<{ jobId: string }> {
  const res = await api.post<ApiResponse<{ jobId: string }>>(
    `/papers/${assignmentId}/regenerate`,
    body ?? {},
  );
  if (!res.data.data) throw new Error(res.data.error ?? 'Unknown error');
  return res.data.data;
}

export function exportPdfUrl(assignmentId: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  return `${base}/papers/${assignmentId}/export/pdf`;
}

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
}

/**
 * Trigger a queued PDF export. Returns immediately:
 *   - status: 'ready'  → PDF already cached; downloadPath is set, no socket wait needed
 *   - status: 'queued' → wait for SOCKET_EVENTS.PDF_READY with the resulting downloadPath
 */
export async function requestPdfExport(
  assignmentId: string,
): Promise<
  | { status: 'ready'; version: number; downloadPath: string }
  | { status: 'queued'; jobId: string; version: number }
> {
  const res = await api.post<ApiResponse<{
    status: 'ready' | 'queued';
    jobId?: string;
    version: number;
    downloadPath?: string;
  }>>(`/papers/${assignmentId}/export/pdf`);
  if (!res.data.data) throw new Error(res.data.error ?? 'Failed to enqueue PDF export');
  return res.data.data as
    | { status: 'ready'; version: number; downloadPath: string }
    | { status: 'queued'; jobId: string; version: number };
}

export function pdfDownloadUrl(downloadPath: string): string {
  // Backend returns paths like "/api/v1/papers/..."; strip the "/api/v1" to avoid
  // double-prefixing when NEXT_PUBLIC_API_URL already includes it.
  const base = apiBaseUrl().replace(/\/api\/v1\/?$/, '');
  return `${base}${downloadPath}`;
}
