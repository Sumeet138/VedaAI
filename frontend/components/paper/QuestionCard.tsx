'use client';

import type { Question } from '@vedaai/shared';
import RichText from './RichText';

interface Props {
  question: Question;
}

const DIFFICULTY_LABEL: Record<Question['difficulty'], string> = {
  easy: 'Easy',
  medium: 'Moderate',
  hard: 'Challenging',
};

const MCQ_LABELS = ['A', 'B', 'C', 'D', 'E'];

export default function QuestionCard({ question }: Props) {
  const diffLabel = DIFFICULTY_LABEL[question.difficulty];

  return (
    <li
      className="text-[13.5px] text-zinc-900 leading-relaxed pl-1"
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      <span className="font-semibold">[{diffLabel}]</span>{' '}
      <RichText text={question.text} />{' '}
      <span className="text-zinc-700 font-semibold whitespace-nowrap">
        [{question.marks} Mark{question.marks !== 1 ? 's' : ''}]
      </span>

      {/* MCQ options */}
      {question.options && question.options.length > 0 && (
        <ul className="mt-2 ml-2 space-y-1">
          {question.options.map((opt, i) => {
            const stripped = opt.replace(/^[A-E]\.\s*/i, '');
            return (
              <li key={i} className="text-[13px] text-zinc-700">
                <span className="font-semibold">{MCQ_LABELS[i] ?? i + 1}.</span>{' '}
                <RichText text={stripped} />
              </li>
            );
          })}
        </ul>
      )}

      {/* True/False placeholder */}
      {question.type === 'true_false' && (
        <span className="text-zinc-500 text-[12px] ml-2">(True / False)</span>
      )}
    </li>
  );
}
