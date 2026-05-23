import { parseSections, PaperParseError } from '../shared/paper-parser';

const VALID_SECTION = {
  title: 'Section A',
  instruction: 'Attempt all questions',
  questionType: 'mcq',
  totalMarks: 10,
  questions: [
    {
      number: 1,
      text: 'What is 2 + 2?',
      type: 'mcq',
      difficulty: 'easy',
      marks: 2,
      options: ['A. 3', 'B. 4', 'C. 5', 'D. 6'],
    },
    {
      number: 2,
      text: 'What is the capital of France?',
      type: 'mcq',
      difficulty: 'medium',
      marks: 3,
      options: ['A. London', 'B. Paris', 'C. Berlin', 'D. Rome'],
    },
  ],
};

const META = {
  paperTitle: 'Chapter 5 Test',
  subject: 'Mathematics',
  gradeLevel: 'Grade 10',
  totalMarks: 10,
};

describe('parseSections', () => {
  it('successfully parses a valid section JSON array', () => {
    const result = parseSections([JSON.stringify(VALID_SECTION)], META);
    expect(result.sections).toHaveLength(1);
    expect(result.paperTitle).toBe('Chapter 5 Test');
    expect(result.subject).toBe('Mathematics');
  });

  it('assigns a UUID id to each section', () => {
    const result = parseSections([JSON.stringify(VALID_SECTION)], META);
    expect(result.sections[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('assigns a UUID id to each question', () => {
    const result = parseSections([JSON.stringify(VALID_SECTION)], META);
    const q = result.sections[0].questions[0];
    expect(q.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('each section gets a unique id', () => {
    const twoSections = [JSON.stringify(VALID_SECTION), JSON.stringify({ ...VALID_SECTION, title: 'Section B' })];
    const result = parseSections(twoSections, { ...META, totalMarks: 20 });
    const ids = result.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('each question gets a unique id', () => {
    const result = parseSections([JSON.stringify(VALID_SECTION)], META);
    const ids = result.sections[0].questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('throws PaperParseError for non-JSON string', () => {
    expect(() => parseSections(['not json at all'], META)).toThrow(PaperParseError);
  });

  it('throws PaperParseError for missing required field (title)', () => {
    const { title: _omit, ...noTitle } = VALID_SECTION;
    expect(() => parseSections([JSON.stringify(noTitle)], META)).toThrow(PaperParseError);
  });

  it('throws PaperParseError for invalid difficulty level', () => {
    const bad = {
      ...VALID_SECTION,
      questions: [{ ...VALID_SECTION.questions[0], difficulty: 'impossible' }],
    };
    expect(() => parseSections([JSON.stringify(bad)], META)).toThrow(PaperParseError);
  });

  it('throws PaperParseError for empty questions array', () => {
    const bad = { ...VALID_SECTION, questions: [] };
    expect(() => parseSections([JSON.stringify(bad)], META)).toThrow(PaperParseError);
  });

  it('throws PaperParseError for invalid question type enum', () => {
    const bad = {
      ...VALID_SECTION,
      questions: [{ ...VALID_SECTION.questions[0], type: 'essay_question' }],
    };
    expect(() => parseSections([JSON.stringify(bad)], META)).toThrow(PaperParseError);
  });

  it('preserves MCQ options in parsed output', () => {
    const result = parseSections([JSON.stringify(VALID_SECTION)], META);
    expect(result.sections[0].questions[0].options).toEqual(['A. 3', 'B. 4', 'C. 5', 'D. 6']);
  });
});
