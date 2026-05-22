import { buildSectionPrompt } from '../shared/prompt-builder';

const base = {
  sectionLabel: 'Section A',
  questionType: 'mcq' as const,
  questionCount: 5,
  marksPerSection: 10,
  assignmentData: {
    title: 'Chapter 5 Test',
    subject: 'Mathematics',
    gradeLevel: 'Grade 10',
  },
};

describe('buildSectionPrompt', () => {
  it('returns a non-empty string', () => {
    expect(typeof buildSectionPrompt(base)).toBe('string');
    expect(buildSectionPrompt(base).length).toBeGreaterThan(50);
  });

  it('includes subject and grade level', () => {
    const prompt = buildSectionPrompt(base);
    expect(prompt).toContain('Mathematics');
    expect(prompt).toContain('Grade 10');
  });

  it('includes question count and marks', () => {
    const prompt = buildSectionPrompt(base);
    expect(prompt).toContain('5');
    expect(prompt).toContain('10');
  });

  it('includes the section label', () => {
    const prompt = buildSectionPrompt(base);
    expect(prompt).toContain('Section A');
  });

  it('includes the question type', () => {
    const prompt = buildSectionPrompt(base);
    expect(prompt.toLowerCase()).toContain('mcq');
  });

  it('includes extracted text when provided', () => {
    const prompt = buildSectionPrompt({ ...base, extractedText: 'Algebra chapter notes' });
    expect(prompt).toContain('Algebra chapter notes');
  });

  it('does not include reference material section when no extracted text', () => {
    const prompt = buildSectionPrompt(base);
    expect(prompt).not.toContain('REFERENCE MATERIAL');
  });

  it('truncates extracted text at 3000 characters', () => {
    const longText = 'x'.repeat(5000);
    const prompt = buildSectionPrompt({ ...base, extractedText: longText });
    expect(prompt).toContain('x'.repeat(3000));
    expect(prompt).not.toContain('x'.repeat(3001));
  });
});
