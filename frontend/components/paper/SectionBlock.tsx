'use client';

import type { Section } from '@vedaai/shared';
import QuestionCard from './QuestionCard';
import { SECTION_SUBHEAD } from '@/lib/mock';

interface Props {
  section: Section;
}

export default function SectionBlock({ section }: Props) {
  const subhead = SECTION_SUBHEAD[section.questionType] ?? section.questionType;
  const eachMark = section.questions[0]?.marks ?? 1;

  return (
    <section>
      {/* Centered Section Heading */}
      <h2 className="text-center text-[18px] font-bold text-zinc-900 mb-4 tracking-tight">
        {section.title}
      </h2>

      {/* Type subheading + italic instruction */}
      <div className="mb-3" style={{ breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
        <h3 className="text-[15px] font-bold text-zinc-900 leading-tight">{subhead}</h3>
        <p className="text-[13px] italic text-zinc-600 mt-0.5">
          {section.instruction.replace(/\.$/, '')}. Each question carries {eachMark} mark{eachMark !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Numbered question list */}
      <ol className="space-y-3 list-decimal pl-5 marker:font-semibold marker:text-zinc-700">
        {section.questions.map((q) => (
          <QuestionCard key={q.id} question={q} />
        ))}
      </ol>
    </section>
  );
}
