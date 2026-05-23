import { usePaperStore } from '@/store/paper.store';
import { useAssignmentStore } from '@/store/assignment.store';
import type { QuestionPaper, QuestionType } from '@vedaai/shared';

export interface MockRow {
  type: QuestionType;
  count: number;
  marks: number;
}

const SECTION_LABELS = ['Section A', 'Section B', 'Section C', 'Section D', 'Section E'];

const SECTION_INSTRUCTIONS: Record<QuestionType, string> = {
  mcq: 'Choose the correct option for each question. Each question carries equal marks.',
  short_answer: 'Answer the following questions in 2–3 sentences each.',
  long_answer: 'Answer the following questions in detail. Draw diagrams wherever applicable.',
  true_false: 'State whether the following statements are True or False.',
  fill_in_blank: 'Fill in the blanks with the most appropriate word or value.',
  numerical: 'Solve the following problems. Show all working clearly.',
  diagram: 'Refer to the diagram or graph shown with each question. Answer based on what is illustrated.',
};

const SECTION_SUBHEAD: Record<QuestionType, string> = {
  mcq: 'Multiple Choice Questions',
  short_answer: 'Short Answer Questions',
  long_answer: 'Long Answer Questions',
  true_false: 'True / False Questions',
  fill_in_blank: 'Fill in the Blanks',
  numerical: 'Numerical Problems',
  diagram: 'Diagram/Graph-Based Questions',
};

interface MockQuestion {
  text: string;
  options?: string[];
  answer: string;
}

const MOCK_Q: Record<QuestionType, MockQuestion[]> = {
  mcq: [
    { text: 'Which of the following is a unit of force?', options: ['Newton', 'Joule', 'Watt', 'Pascal'], answer: 'A. Newton' },
    { text: 'The speed of light in vacuum is approximately:', options: ['3 × 10⁸ m/s', '3 × 10⁶ m/s', '3 × 10¹⁰ m/s', '3 × 10⁴ m/s'], answer: 'A. 3 × 10⁸ m/s' },
    { text: 'Which element has the atomic number 6?', options: ['Oxygen', 'Carbon', 'Nitrogen', 'Hydrogen'], answer: 'B. Carbon' },
    { text: "Newton's second law states that Force equals:", options: ['Mass × Velocity', 'Mass × Acceleration', 'Mass × Distance', 'Mass × Speed'], answer: 'B. Mass × Acceleration' },
    { text: 'What is the SI unit of electric current?', options: ['Ampere', 'Volt', 'Ohm', 'Watt'], answer: 'A. Ampere' },
    { text: 'The process of solid converting directly to gas is called:', options: ['Sublimation', 'Evaporation', 'Condensation', 'Deposition'], answer: 'A. Sublimation' },
    { text: 'Which organelle is known as the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Chloroplast'], answer: 'C. Mitochondria' },
    { text: 'The chemical formula of water is:', options: ['H₂O', 'CO₂', 'NaCl', 'O₂'], answer: 'A. H₂O' },
    { text: 'What is the value of acceleration due to gravity on Earth?', options: ['9.8 m/s²', '8.9 m/s²', '10.8 m/s²', '9.0 m/s²'], answer: 'A. 9.8 m/s²' },
    { text: "Which gas is most abundant in the Earth's atmosphere?", options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], answer: 'C. Nitrogen' },
    { text: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], answer: 'B. Mercury' },
    { text: 'The unit of electrical resistance is:', options: ['Ohm', 'Volt', 'Ampere', 'Farad'], answer: 'A. Ohm' },
    { text: 'What is the chemical formula of table salt?', options: ['NaCl', 'KCl', 'CaCl₂', 'MgCl₂'], answer: 'A. NaCl' },
    { text: 'The SI unit of energy is:', options: ['Joule', 'Watt', 'Newton', 'Pascal'], answer: 'A. Joule' },
    { text: 'Which of the following is NOT a renewable energy source?', options: ['Solar', 'Wind', 'Coal', 'Hydroelectric'], answer: 'C. Coal' },
  ],
  short_answer: [
    { text: "State Newton's second law and write its mathematical expression $F = ma$.", answer: "Newton's second law states force equals mass times acceleration: $F = ma$. Net force on a body produces acceleration in its direction." },
    { text: 'Trace the current path in the simple circuit below and identify the role of each component.\n<mermaid>\ngraph LR\n  B((Battery)) --> S[Switch]\n  S --> R[Resistor]\n  R --> B\n</mermaid>', answer: 'Current flows from the battery positive terminal through the switch (controls flow), then through the resistor (limits current), and back to the battery negative terminal forming a closed loop.' },
    { text: 'Compute the kinetic energy of a 2 kg object moving at 3 m/s using $KE = \\tfrac{1}{2}mv^2$.', answer: '$KE = \\tfrac{1}{2}(2)(3)^2 = 9$ J.' },
    { text: "Define Newton's first law of motion with an example.", answer: 'A body at rest stays at rest and a body in motion stays in motion unless acted upon by an external force. Example: a book on a table remains there until pushed.' },
    { text: 'What is the difference between speed and velocity?', answer: 'Speed is a scalar quantity measuring how fast an object moves. Velocity is a vector that includes both speed and direction.' },
    { text: 'Explain the process of photosynthesis briefly.', answer: 'Photosynthesis is the process by which green plants use sunlight, water, and CO₂ to produce glucose and oxygen in the chloroplasts.' },
    { text: "State Ohm's law and write its mathematical expression.", answer: 'Ohm\'s law states that current through a conductor is proportional to the voltage applied, given by V = IR.' },
    { text: 'What is thermal expansion? Give one example.', answer: 'Thermal expansion is the increase in size of a substance when heated. Example: railway tracks expanding on hot days.' },
    { text: 'Differentiate between a conductor and an insulator.', answer: 'A conductor allows electric current to flow easily (e.g. copper). An insulator does not allow current to flow (e.g. rubber).' },
    { text: 'What is pH value? What is the pH of pure water?', answer: 'pH measures the acidity or alkalinity of a solution on a scale of 0 to 14. Pure water has a pH of 7 (neutral).' },
    { text: "Explain the term 'refraction of light'.", answer: 'Refraction is the bending of light as it passes from one medium to another due to a change in its speed.' },
    { text: "What is meant by 'work' in physics? Give its SI unit.", answer: 'Work is done when a force causes displacement, calculated as W = F × d. SI unit is the Joule (J).' },
    { text: 'Distinguish between kinetic energy and potential energy.', answer: 'Kinetic energy is energy of motion (½mv²). Potential energy is stored energy due to position or configuration (mgh for gravitational PE).' },
    { text: 'What is the difference between acids and bases?', answer: 'Acids release H⁺ ions in water and turn blue litmus red. Bases release OH⁻ ions and turn red litmus blue.' },
    { text: 'Explain what happens during nuclear fission.', answer: 'In nuclear fission, a heavy nucleus splits into two lighter nuclei, releasing energy and neutrons that can trigger a chain reaction.' },
  ],
  long_answer: [
    { text: 'Explain electrolysis of brine. Write the balanced equation:\n$$\\ce{2NaCl + 2H2O -> 2NaOH + H2 ^ + Cl2 ^}$$', answer: 'Brine (NaCl solution) is electrolysed industrially in the chlor-alkali process. At the cathode, water is reduced producing H₂ and OH⁻. At the anode, Cl⁻ is oxidised to Cl₂. Net: $$\\ce{2NaCl + 2H2O -> 2NaOH + H2 ^ + Cl2 ^}$$ Products: sodium hydroxide (in solution), hydrogen, chlorine gas.' },
    { text: 'Draw and explain the carbon cycle using a flow diagram.\n<mermaid>\ngraph LR\n  Atm[Atmosphere CO2] -- photosynthesis --> Plants\n  Plants -- respiration --> Atm\n  Plants -- consumed --> Animals\n  Animals -- respiration --> Atm\n  Animals -- decomposition --> Soil\n  Soil -- combustion --> Atm\n</mermaid>', answer: 'Carbon cycles between atmosphere, biosphere, and lithosphere. Plants absorb CO₂ via photosynthesis. Animals consume plants and respire CO₂ back. Decomposers return carbon to soil. Combustion of fossil fuels and respiration release CO₂ back to the atmosphere.' },
    { text: 'Describe the structure and function of the human heart with a labeled diagram.', answer: 'The human heart is a four-chambered muscular organ with two atria (upper) and two ventricles (lower). The right side pumps deoxygenated blood to the lungs; the left side pumps oxygenated blood to the body. Valves prevent backflow. Key parts: SA node (pacemaker), aorta, pulmonary artery/vein, vena cava.' },
    { text: "Explain Newton's laws of motion with suitable examples and mathematical expressions.", answer: 'First law (inertia): body remains at rest/motion unless acted on by net force. Second law: F = ma — force is mass times acceleration. Third law: every action has equal and opposite reaction. Examples: seatbelt (1st), pushing trolley (2nd), rocket propulsion (3rd).' },
    { text: 'Draw and explain the carbon cycle, highlighting the role of photosynthesis and respiration.', answer: 'Carbon cycles between atmosphere, plants, animals, and soil. Plants absorb CO₂ via photosynthesis → glucose. Animals eat plants and respire CO₂ back. Decomposition and combustion also release CO₂. Oceans absorb and release CO₂ as well.' },
    { text: 'Describe the working principle of an electric generator with a neat diagram.', answer: 'An electric generator converts mechanical energy to electrical energy using electromagnetic induction. A coil rotating in a magnetic field cuts magnetic flux, inducing EMF. Slip rings and brushes carry current to external circuit. Used in power plants.' },
    { text: 'Explain the process of nuclear fission and fusion. How are they used in energy production?', answer: 'Fission splits heavy nuclei (e.g. U-235) releasing huge energy, used in nuclear reactors. Fusion combines light nuclei (H to He) producing even more energy — the Sun\'s process. Fusion reactors are under development (ITER).' },
    { text: "Describe the structure of the atom with reference to Bohr's model.", answer: 'Bohr proposed electrons orbit the nucleus in discrete energy levels (shells). Protons and neutrons reside in the nucleus. Electrons jump between shells emitting/absorbing photons of fixed energy E = hf. Explained hydrogen spectrum.' },
    { text: 'Explain the laws of reflection and refraction with diagrams and real-life examples.', answer: 'Reflection: angle of incidence = angle of reflection; both lie on the same plane as the normal. Refraction (Snell\'s law): n₁ sin θ₁ = n₂ sin θ₂. Examples: mirror image (reflection), pencil bent in water (refraction).' },
    { text: 'Describe the water cycle and explain how human activities affect it.', answer: 'Water cycles via evaporation → condensation → precipitation → collection. Driven by solar energy. Human impacts: deforestation reduces transpiration; pollution contaminates groundwater; dams alter flow; climate change shifts rainfall patterns.' },
  ],
  fill_in_blank: [
    { text: 'The SI unit of power is ___.', answer: 'Watt (W)' },
    { text: 'The chemical symbol for gold is ___.', answer: 'Au' },
    { text: 'The speed of sound in air at 0°C is approximately ___ m/s.', answer: '331' },
    { text: 'The process by which plants make food is called ___.', answer: 'photosynthesis' },
    { text: 'The atomic number of hydrogen is ___.', answer: '1' },
    { text: '___ is the hardest natural substance on Earth.', answer: 'Diamond' },
    { text: 'The formula of sulphuric acid is ___.', answer: 'H₂SO₄' },
    { text: 'The unit of electric resistance is ___.', answer: 'Ohm (Ω)' },
    { text: 'The boiling point of water at sea level is ___ °C.', answer: '100' },
    { text: "Newton's universal gravitational constant G = ___ N m² kg⁻².", answer: '6.674 × 10⁻¹¹' },
  ],
  true_false: [
    { text: 'The Earth revolves around the Sun once every 365.25 days.', answer: 'True' },
    { text: 'Sound travels faster in vacuum than in air.', answer: 'False' },
    { text: 'The chemical formula of common salt is NaCl.', answer: 'True' },
    { text: 'Photosynthesis occurs in the mitochondria of plant cells.', answer: 'False' },
    { text: 'The boiling point of water at sea level is 100°C.', answer: 'True' },
    { text: 'Neutrons carry a positive charge.', answer: 'False' },
    { text: 'DNA stands for Deoxyribonucleic Acid.', answer: 'True' },
    { text: 'The heart is a muscular organ located in the thoracic cavity.', answer: 'True' },
    { text: 'Light travels in a straight line in a uniform medium.', answer: 'True' },
    { text: 'The atomic mass of carbon is 12.', answer: 'True' },
  ],
  numerical: [
    {
      text: 'Plot the function $f(x) = x^2 - 4$ on the coordinate plane. Identify the x-intercepts and the vertex.\n<plot>{"fn":"x^2 - 4","xDomain":[-5,5],"yDomain":[-6,10],"title":"f(x) = x² − 4"}</plot>',
      answer: 'x-intercepts: $x = \\pm 2$. Vertex: $(0, -4)$. Parabola opens upward with axis of symmetry $x = 0$.',
    },
    {
      text: 'A ball is thrown upward with initial velocity $u = 20$ m/s. Using $h(t) = ut - \\tfrac{1}{2}gt^2$ with $g = 10$ m/s², find the maximum height and time to reach it.',
      answer: 'Max height at $t = u/g = 2$ s. $h_{max} = 20(2) - \\tfrac{1}{2}(10)(4) = 20$ m.',
    },
    {
      text: 'Sketch the line $y = 2x + 1$. Mark its y-intercept and slope.\n<plot>{"fn":"2*x + 1","xDomain":[-5,5],"yDomain":[-9,11],"title":"y = 2x + 1"}</plot>',
      answer: 'Slope = 2, y-intercept = $(0, 1)$. Line passes through $(-1, -1)$ and $(2, 5)$.',
    },
    {
      text: 'Solve the simultaneous equations: $2x + 3y = 12$ and $x - y = 1$.',
      answer: 'From eq2: $x = y + 1$. Substituting: $2(y+1) + 3y = 12 \\Rightarrow 5y = 10 \\Rightarrow y = 2$, hence $x = 3$.',
    },
    {
      text: 'Compute the area under $y = x$ from $x = 0$ to $x = 4$ using the definite integral $\\int_0^4 x\\, dx$.',
      answer: '$\\int_0^4 x\\, dx = \\tfrac{x^2}{2}\\Big|_0^4 = 8$ square units.',
    },
  ],
  diagram: [
    {
      text: 'Identify each component in the circuit shown below and explain the direction of conventional current flow.\n<mermaid>\ngraph LR\n  B((Battery)) --> S[Switch]\n  S --> R[Resistor]\n  R --> L((Lamp))\n  L --> B\n</mermaid>',
      answer: 'Conventional current flows from battery positive terminal → switch → resistor → lamp → back to battery negative terminal. Switch controls flow; resistor limits current; lamp converts electrical to light energy.',
    },
    {
      text: 'The graph below shows displacement versus time for a moving object. Determine its velocity.\n<plot>{"fn":"3*x","xDomain":[0,5],"yDomain":[0,18],"title":"Displacement vs Time","xLabel":"t (s)","yLabel":"s (m)"}</plot>',
      answer: 'Slope = $\\tfrac{\\Delta s}{\\Delta t} = 3$ m/s. Object moves with constant velocity of 3 m/s.',
    },
    {
      text: 'Trace the carbon cycle below and explain each step briefly.\n<mermaid>\ngraph LR\n  A[Atmospheric CO₂] -- photosynthesis --> P[Plants]\n  P -- respiration --> A\n  P -- consumed --> An[Animals]\n  An -- respiration --> A\n  An -- decomposition --> S[Soil]\n  S -- combustion --> A\n</mermaid>',
      answer: 'Plants absorb CO₂ via photosynthesis. Animals eat plants and respire CO₂ back. Decomposers return carbon to soil. Combustion releases CO₂ to the atmosphere.',
    },
  ],
};

const PROGRESS_STEPS = [
  { status: 'queued',     progress: 0,  message: 'Waiting in queue…' },
  { status: 'extracting', progress: 10, message: 'Extracting content…' },
  { status: 'prompting',  progress: 20, message: 'Building question prompt…' },
  { status: 'generating', progress: 50, message: 'Generating with AI…' },
  { status: 'parsing',    progress: 80, message: 'Parsing AI response…' },
  { status: 'saving',     progress: 90, message: 'Saving paper…' },
];

function getDifficulty(i: number): 'easy' | 'medium' | 'hard' {
  const mod = i % 5;
  if (mod < 2) return 'easy';
  if (mod < 4) return 'medium';
  return 'hard';
}

export function buildMockPaper(assignmentId: string, rows: MockRow[], title: string): QuestionPaper {
  const now = new Date().toISOString();
  const totalMarks = rows.reduce((s, r) => s + r.count * r.marks, 0);
  const totalQuestions = rows.reduce((s, r) => s + r.count, 0);

  const sections = rows.map((row, sIdx) => ({
    id: crypto.randomUUID(),
    title: SECTION_LABELS[sIdx] ?? `Section ${String.fromCharCode(65 + sIdx)}`,
    instruction: SECTION_INSTRUCTIONS[row.type],
    questionType: row.type,
    totalMarks: row.count * row.marks,
    questions: Array.from({ length: row.count }, (_, qIdx) => {
      const pool = MOCK_Q[row.type];
      const q = pool[qIdx % pool.length];
      return {
        id: crypto.randomUUID(),
        number: qIdx + 1,
        text: q.text,
        type: row.type,
        difficulty: getDifficulty(qIdx),
        marks: row.marks,
        answer: q.answer,
        ...(q.options ? { options: q.options } : {}),
      };
    }),
  }));

  return {
    _id: crypto.randomUUID(),
    assignmentId,
    paperTitle: title,
    schoolName: 'Delhi Public School, Sector-4, Bokaro',
    subject: 'English',
    gradeLevel: '5th',
    totalMarks,
    duration: `${Math.ceil(totalQuestions * 1.5)} minutes`,
    instructions: [
      'All questions are compulsory unless stated otherwise.',
      'Write clearly and show all workings where applicable.',
      'Read each question carefully before answering.',
    ],
    version: 1,
    sections,
    createdAt: now,
    updatedAt: now,
  };
}

export { SECTION_SUBHEAD };

export function simulateGeneration(assignmentId: string, rows: MockRow[], title: string) {
  const { setProgress, setPaper } = usePaperStore.getState();
  const { upsert } = useAssignmentStore.getState();

  const now = new Date().toISOString();
  const mockAssignment = {
    _id: assignmentId,
    title,
    subject: 'English',
    gradeLevel: '5th',
    dueDate: new Date(Date.now() + 86_400_000).toISOString(),
    questionTypes: rows.map((r) => r.type),
    totalQuestions: rows.reduce((s, r) => s + r.count, 0),
    totalMarks: rows.reduce((s, r) => s + r.count * r.marks, 0),
    status: 'processing' as const,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  upsert(mockAssignment);

  PROGRESS_STEPS.forEach((step, i) => {
    setTimeout(() => {
      setProgress(assignmentId, { assignmentId, ...step });
    }, i * 700);
  });

  setTimeout(() => {
    const paper = buildMockPaper(assignmentId, rows, title);
    setPaper(assignmentId, paper);
    setProgress(assignmentId, { assignmentId, status: 'completed', progress: 100, message: 'Done!' });
    upsert({ ...mockAssignment, status: 'completed' });
  }, PROGRESS_STEPS.length * 700 + 400);
}
