/**
 * Neural Diagnostic Onboarding — typed question schema (5 steps).
 *
 * Profile axes (the personalization spine of the whole app):
 *   operatingProfile — neurodivergent vs neurotypical (sensory scaffolding)
 *   coreArena        — who the user is (vocabulary + copy voice)
 *   bottleneck       — what is breaking (protocol selection)
 *   stressSignature  — how stress expresses (somatic vs cognitive emphasis)
 *   ageBracket       — demographic context
 */

export type OperatingProfile = 'neurodivergent' | 'neurotypical';
export type CoreArena = 'athlete' | 'student' | 'creator-founder';
export type Bottleneck = 'anxiety' | 'fog' | 'sluggish' | 'burnout';
export type StressSignature = 'somatic' | 'cognitive';
export type AgeBracket = 'under-18' | '18-24' | '25-34' | '35-plus';

export type DiagnosticAnswers = {
  operatingProfile: OperatingProfile;
  coreArena: CoreArena;
  bottleneck: Bottleneck;
  stressSignature: StressSignature;
  ageBracket: AgeBracket;
};

export type DiagnosticKey = keyof DiagnosticAnswers;

export type DiagnosticOption = {
  id: string;
  label: string;
  desc: string;
  icon: string;
};

export type DiagnosticQuestion = {
  key: DiagnosticKey;
  kicker: string;
  question: string;
  accent: string;
  options: DiagnosticOption[];
};

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    key: 'operatingProfile',
    kicker: 'Cognitive Operating Profile',
    question: 'Select your cognitive operating profile.',
    accent: '#f472b6',
    options: [
      {
        id: 'neurodivergent',
        label: 'Neurodivergent',
        desc: 'ADHD · ADD · ASD — high-valence sensory scaffolding, non-distracting interest layer',
        icon: '⌬',
      },
      {
        id: 'neurotypical',
        label: 'Neurotypical',
        desc: 'Standard response curve — clean, minimalist low-stimulus audio profile',
        icon: '◎',
      },
    ],
  },
  {
    key: 'coreArena',
    kicker: 'The Arena',
    question: 'Where do you deploy your focus?',
    accent: '#7c5cff',
    options: [
      { id: 'athlete',         label: 'Athlete / Competitor', desc: 'Reaction time, clutch execution, game-day nerves', icon: '⌖' },
      { id: 'student',         label: 'Student',              desc: 'Lectures, exams, long study blocks',               icon: '✎' },
      { id: 'creator-founder', label: 'Creator / Founder',    desc: 'Deep work, code, design, shipping under pressure', icon: '⌨' },
    ],
  },
  {
    key: 'bottleneck',
    kicker: 'The Bottleneck',
    question: 'What is breaking your performance right now?',
    accent: '#fb923c',
    options: [
      { id: 'sluggish', label: 'Sluggish / Procrastination', desc: 'Cannot initiate — tasks slide for hours',    icon: '☾' },
      { id: 'fog',      label: 'Mid-day Fog',                desc: 'Sharp mornings collapse into screen coma',    icon: '≋' },
      { id: 'anxiety',  label: 'High-pressure Anxiety',      desc: 'Racing thoughts when the stakes spike',       icon: '〜' },
      { id: 'burnout',  label: 'Total Burnout',              desc: 'Wired-and-tired · cannot down-shift',         icon: '↯' },
    ],
  },
  {
    key: 'stressSignature',
    kicker: 'Stress Signature',
    question: 'Under pressure, where does it hit first?',
    accent: '#22d3ee',
    options: [
      { id: 'somatic',   label: 'Somatic — In the Body',  desc: 'Physical tension, jitters, tapping, tight chest', icon: '⚡' },
      { id: 'cognitive', label: 'Cognitive — In the Mind', desc: 'Racing thoughts, looping, overthinking',          icon: '≋' },
    ],
  },
  {
    key: 'ageBracket',
    kicker: 'Neuro-Demographic',
    question: 'Age bracket — entrainment response varies with cortical development.',
    accent: '#4ade80',
    options: [
      { id: 'under-18', label: 'Under 18', desc: 'Developing-cortex response curve', icon: '·' },
      { id: '18-24',    label: '18 – 24',  desc: 'Peak plasticity window',           icon: '··' },
      { id: '25-34',    label: '25 – 34',  desc: 'Full-maturation baseline',         icon: '···' },
      { id: '35-plus',  label: '35+',      desc: 'Stability-weighted calibration',   icon: '····' },
    ],
  },
];
