import type { Assignment } from '../models/assignment.types';
import type { QuestionPaper } from '../models/question-paper.types';
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface CreateAssignmentResponse {
    assignment: Assignment;
    jobId: string;
}
export interface GetPaperResponse {
    paper: QuestionPaper;
    assignment: Assignment;
}
export interface ListAssignmentsResponse {
    assignments: Assignment[];
    total: number;
}
//# sourceMappingURL=response.types.d.ts.map