'use client';

import type { QuestionPaper } from '@vedaai/shared';
import RichText from './RichText';

interface Props {
  paper: QuestionPaper;
}

export default function AnswerKey({ paper }: Props) {
  // Flatten all questions across sections, preserving order
  const flat = paper.sections.flatMap((s) =>
    s.questions.map((q) => ({ sectionTitle: s.title, question: q })),
  );

  const hasAnyAnswer = flat.some((x) => x.question.answer);
  if (!hasAnyAnswer) return null;

  return (
    <section className="mt-10 pt-6 border-t-2 border-dashed border-zinc-300 print:break-before-page">
      <h2 className="text-[18px] font-bold text-zinc-900 mb-4">Answer Key:</h2>
      <ol className="space-y-3 list-decimal pl-5 marker:font-semibold marker:text-zinc-700">
        {flat.map(({ question, sectionTitle }) => (
          <li key={question.id} className="text-[13px] text-zinc-800 leading-relaxed">
            {question.answer ? (
              <span className="whitespace-pre-line"><RichText text={question.answer} /></span>
            ) : (
              <span className="italic text-zinc-400">
                Answer not provided ({sectionTitle} Q{question.number})
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
