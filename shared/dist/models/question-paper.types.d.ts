import type { QuestionType } from './assignment.types';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export interface Question {
    id: string;
    number: number;
    text: string;
    type: QuestionType;
    difficulty: DifficultyLevel;
    marks: number;
    options?: string[];
    answer?: string;
}
export interface Section {
    id: string;
    title: string;
    instruction: string;
    questionType: QuestionType;
    totalMarks: number;
    questions: Question[];
}
export interface QuestionPaper {
    _id: string;
    assignmentId: string;
    paperTitle: string;
    schoolName?: string;
    subject: string;
    gradeLevel: string;
    totalMarks: number;
    duration?: string;
    instructions?: string[];
    version: number;
    sections: Section[];
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=question-paper.types.d.ts.map