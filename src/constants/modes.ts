export type FocusModeId = 'deep-focus' | 'flow-state' | 'calm-reset' | 'cognitive-cooldown';

export type FocusMode = {
  id: FocusModeId;
  title: string;
  subtitle: string;
  accent: string;
  carrierHz: number;
  beatHz: number;
};

export const FOCUS_MODES: FocusMode[] = [
  {
    id: 'deep-focus',
    title: 'Deep Focus',
    subtitle: 'Gamma entrainment · high alertness',
    accent: '#7c5cff',
    carrierHz: 200,
    beatHz: 40,
  },
  {
    id: 'flow-state',
    title: 'Flow State',
    subtitle: 'Alpha-theta bridge · sustained attention',
    accent: '#5eead4',
    carrierHz: 220,
    beatHz: 10,
  },
  {
    id: 'calm-reset',
    title: 'Calm Reset',
    subtitle: 'Alpha dominance · nervous system downshift',
    accent: '#60a5fa',
    carrierHz: 180,
    beatHz: 8,
  },
  {
    id: 'cognitive-cooldown',
    title: 'Cognitive Cooldown',
    subtitle: 'Fractionation cycle · recovery window',
    accent: '#f472b6',
    carrierHz: 160,
    beatHz: 6,
  },
];

export const STAT_BOXES = [
  { value: '92%', label: 'Less Jitters', detail: 'vs. stimulant baseline' },
  { value: 'Zero', label: 'Chemical Crash', detail: 'non-pharmacological entrainment' },
  { value: '<3s', label: 'Key Match', detail: 'Spotify harmonic recalibration' },
  { value: '24/7', label: 'Parallel Audio', detail: 'mixes with Spotify · no ducking' },
] as const;
