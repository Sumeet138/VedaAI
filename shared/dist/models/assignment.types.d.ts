export declare const QUESTION_TYPES: readonly ["mcq", "short_answer", "long_answer", "true_false", "fill_in_blank", "numerical", "diagram"];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type AssignmentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface Assignment {
    _id: string;
    title: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    dueDate: string;
    questionTypes: QuestionType[];
    totalQuestions: number;
    totalMarks: number;
    additionalInstructions?: string;
    extractedText?: string;
    status: AssignmentStatus;
    jobId?: string;
    errorMessage?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=assignment.types.d.ts.map