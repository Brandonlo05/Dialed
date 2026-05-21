export type FocusModeId = 'standard-focus' | 'deep-lockdown' | 'caffeine-rush' | 'clutch-mode';

export type FocusMode = {
  id: FocusModeId;
  title: string;
  subtitle: string;
  accent: string;
  icon: string;
  carrierHz: number;
  beatHz: number;
};

export const FOCUS_MODES: FocusMode[] = [
  {
    id: 'standard-focus',
    title: 'Standard Focus',
    subtitle: 'Alpha bridge · sustained attention · 10 Hz',
    accent: '#7c5cff',
    icon: '◎',
    carrierHz: 220,
    beatHz: 10,
  },
  {
    id: 'deep-lockdown',
    title: 'Deep Lockdown',
    subtitle: 'Gamma entrainment · high alertness · 40 Hz',
    accent: '#5eead4',
    icon: '⬡',
    carrierHz: 200,
    beatHz: 40,
  },
  {
    id: 'caffeine-rush',
    title: 'Caffeine Rush',
    subtitle: 'Beta burst · peak energy · 20 Hz',
    accent: '#fb923c',
    icon: '⚡',
    carrierHz: 240,
    beatHz: 20,
  },
  {
    id: 'clutch-mode',
    title: 'Clutch Mode',
    subtitle: 'Theta-alpha · pressure performance · 7 Hz',
    accent: '#f472b6',
    icon: '◆',
    carrierHz: 180,
    beatHz: 7,
  },
];

export const STAT_BOXES = [
  {
    value: '92%',
    label: 'Less Jitters',
    detail: 'vs. stimulant baseline',
    accentColor: '#7c5cff',
  },
  {
    value: 'Zero',
    label: 'Chemical Crash',
    detail: 'non-pharmacological entrainment',
    accentColor: '#5eead4',
  },
  {
    value: '<3s',
    label: 'Key Match',
    detail: 'Spotify harmonic recalibration',
    accentColor: '#fb923c',
  },
  {
    value: '24/7',
    label: 'Parallel Audio',
    detail: 'mixes with Spotify · no ducking',
    accentColor: '#f472b6',
  },
] as const;
