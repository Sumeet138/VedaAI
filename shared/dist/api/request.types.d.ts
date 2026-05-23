import type { QuestionType } from '../models/assignment.types';
export interface CreateAssignmentRequest {
    title: string;
    subject: string;
    gradeLevel: string;
    dueDate: string;
    questionTypes: QuestionType[];
    totalQuestions: number;
    totalMarks: number;
    additionalInstructions?: string;
}
export interface RegeneratePaperRequest {
    additionalInstructions?: string;
}
//# sourceMappingURL=request.types.d.ts.map