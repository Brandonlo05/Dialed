/**
 * Neural Diagnostic Onboarding — typed question schema (4 steps).
 * Answers classify the user and drive both the smart program
 * recommendation and the derived audio-calibration profile.
 */

export type Arena = 'student' | 'engineer-creator' | 'athlete-gamer' | 'professional';
export type Bottleneck = 'sluggish' | 'mid-day-fog' | 'high-pressure-anxiety' | 'total-burnout';
export type StressResponse = 'anxious-restless' | 'sluggish-paralyzed';
export type AgeBracket = 'under-18' | '18-24' | '25-34' | '35-plus';

export type DiagnosticAnswers = {
  arena: Arena;
  bottleneck: Bottleneck;
  stressResponse: StressResponse;
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
    key: 'arena',
    kicker: 'The Arena',
    question: 'Where do you deploy your focus?',
    accent: '#7c5cff',
    options: [
      { id: 'student',          label: 'Student',            desc: 'Lectures, exams, long study blocks', icon: '✎' },
      { id: 'engineer-creator', label: 'Engineer / Creator', desc: 'Deep work, code, design, shipping',  icon: '⌨' },
      { id: 'athlete-gamer',    label: 'Athlete / Gamer',    desc: 'Reaction time, clutch execution',    icon: '⌖' },
      { id: 'professional',     label: 'Professional',       desc: 'Meetings, output, sustained load',   icon: '◫' },
    ],
  },
  {
    key: 'bottleneck',
    kicker: 'The Bottleneck',
    question: 'What is breaking your performance right now?',
    accent: '#fb923c',
    options: [
      { id: 'sluggish',               label: 'Sluggish / Procrastination', desc: 'Cannot initiate — tasks slide for hours',   icon: '☾' },
      { id: 'mid-day-fog',            label: 'Mid-day Fog',                desc: 'Sharp mornings collapse into screen coma',   icon: '≋' },
      { id: 'high-pressure-anxiety',  label: 'High-pressure Anxiety',      desc: 'Racing thoughts when the stakes spike',      icon: '〜' },
      { id: 'total-burnout',          label: 'Total Burnout',              desc: 'Wired-and-tired · cannot down-shift',        icon: '↯' },
    ],
  },
  {
    key: 'stressResponse',
    kicker: 'Stress Signature',
    question: 'Under pressure, your system goes…',
    accent: '#22d3ee',
    options: [
      { id: 'anxious-restless',   label: 'Anxious / Restless',   desc: 'Heart rate up, foot tapping, spiraling', icon: '⚡' },
      { id: 'sluggish-paralyzed', label: 'Sluggish / Paralyzed', desc: 'System freezes — heavy, blank, stuck',   icon: '❄' },
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
