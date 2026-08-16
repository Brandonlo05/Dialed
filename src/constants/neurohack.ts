/**
 * NEUROHACK — eight acute micro-states.
 *
 * These existed only in the web demo until now; this file ports them to the
 * native engine. Each entry is a *declarative payload*, not an imperative
 * `engage()` closure like the demo used — the routing engine reads the payload
 * and drives the Swift bridge. Declarative matters here: the same payload is
 * reused to render the card, seed Now Playing telemetry, and populate the
 * lock-screen Now Playing Info, so there is exactly one definition per state.
 *
 * COPY DISCIPLINE
 * `promise` describes what the user is likely to *experience*. It deliberately
 * makes no claim about mechanism, diagnosis or treatment — the same
 * structure-function framing used across the preset library.
 *
 * A note on `glide`: several states ramp the beat frequency over minutes
 * (e.g. High Stress 25→12 Hz). That ramp runs natively at block level via
 * setBeatGlide, NOT on a JS timer — a backgrounded JS thread would stall the
 * ramp, and the user would be left parked at the starting frequency.
 */

import type { BreathPatternId } from './breathwork';

export type NeuroHackId =
  | 'cortisol-redline'
  | 'executive-friction'
  | 'sensory-saturation'
  | 'attentional-drift'
  | 'psychomotor-agitation'
  | 'cognitive-slump'
  | 'creative-stagnation'
  | 'sympathetic-flare';

export type NeuroHackPayload = {
  carrierHz: number;
  beatHz: number;
  noise?: 'brown' | 'pink';
  /** Per-channel AM. Depth 0 leaves that channel a clean carrier. */
  amLeftHz?: number;
  amLeftDepth?: number;
  amRightHz?: number;
  amRightDepth?: number;
  /**
   * Native block-level beat ramp: settle onto `toHz` over `seconds`.
   * Implemented with setBeatGlide's linear rate so it survives backgrounding.
   */
  glide?: { toHz: number; seconds: number };
};

export type NeuroHack = {
  id: NeuroHackId;
  /** What the user feels — the card's headline. */
  label: string;
  /** Clinical-register name, shown small. Adds credibility without claiming. */
  name: string;
  icon: string;
  accent: string;
  /** Short experiential promise. No mechanism claims. */
  promise: string;
  hzLabel: string;
  /** Engineering readout for the Now Playing telemetry strip. */
  telemetry: string;
  breath: BreathPatternId;
  payload: NeuroHackPayload;
};

/**
 * Ordered by how often the state actually sends someone reaching for the app —
 * acute stress first, creative block last. The grid reads top-left → down.
 */
export const NEURO_HACKS: NeuroHack[] = [
  {
    id: 'cortisol-redline',
    label: 'High Stress',
    name: 'Cortisol Redline',
    icon: '🚨',
    accent: '#00E5FF',
    promise: 'Ramps down with you instead of dropping you straight into calm.',
    hzLabel: '25 → 12 Hz',
    telemetry: 'L 400 Hz · R 425→412 Hz auto-ramp 200 s · SMR anchor',
    breath: 'extended-exhale',
    payload: {
      carrierHz: 400,
      beatHz: 25,
      // Meeting the user where they are (25 Hz, agitated) and walking down to
      // 12 Hz beats starting at 12 Hz, which feels like a mismatch when keyed up.
      glide: { toHz: 12, seconds: 200 },
    },
  },
  {
    id: 'executive-friction',
    label: 'Brain Block',
    name: 'Executive Friction',
    icon: '🧠',
    accent: '#4ade80',
    promise: 'For when you know the task and still cannot start it.',
    hzLabel: '13 Hz SMR · left',
    telemetry: 'L 400 Hz AM 13 Hz idx 0.40 · R 400 Hz clean carrier',
    breath: 'box',
    payload: { carrierHz: 400, beatHz: 0, amLeftHz: 13, amLeftDepth: 0.4 },
  },
  {
    id: 'sensory-saturation',
    label: 'Brain Fog',
    name: 'Sensory Saturation',
    icon: '🌫️',
    accent: '#39FF14',
    promise: 'Bright and clearing — meant to lift without winding you up.',
    hzLabel: '40 Hz ASSR',
    telemetry: 'L/R 400 Hz AM 40 Hz · pink floor 20%',
    breath: 'brisk-even',
    payload: {
      carrierHz: 400, beatHz: 0, noise: 'pink',
      amLeftHz: 40, amLeftDepth: 0.9, amRightHz: 40, amRightDepth: 0.9,
    },
  },
  {
    id: 'attentional-drift',
    label: 'Distracted',
    name: 'Attentional Drift',
    icon: '🎯',
    accent: '#22d3ee',
    promise: 'A steady 10 Hz pulse to hold onto when attention keeps sliding.',
    hzLabel: '10 Hz α',
    telemetry: 'L/R 400 Hz AM 10 Hz matched rate',
    breath: 'box',
    payload: {
      carrierHz: 400, beatHz: 0,
      amLeftHz: 10, amLeftDepth: 0.6, amRightHz: 10, amRightDepth: 0.6,
    },
  },
  {
    id: 'psychomotor-agitation',
    label: 'Jittery',
    name: 'Psychomotor Agitation',
    icon: '🫨',
    accent: '#FFD700',
    promise: 'Split-channel texture for restless hands and a racing chest.',
    hzLabel: 'L 13 / R 10 Hz',
    telemetry: 'L 400 Hz AM 13 Hz d0.85 · R 400 Hz AM 10 Hz d0.60',
    breath: 'relaxing-478',
    payload: {
      carrierHz: 400, beatHz: 0,
      amLeftHz: 13, amLeftDepth: 0.85, amRightHz: 10, amRightDepth: 0.6,
    },
  },
  {
    id: 'cognitive-slump',
    label: 'Sluggish',
    name: 'Cognitive Slump',
    icon: '🪫',
    accent: '#FF007F',
    promise: 'Faster and brighter, for the 3pm wall.',
    hzLabel: '20 Hz β',
    telemetry: 'L 450 Hz · R 470 Hz · 20 Hz β',
    breath: 'activating',
    payload: { carrierHz: 450, beatHz: 20 },
  },
  {
    id: 'creative-stagnation',
    label: 'Stuck',
    name: 'Creative Stagnation',
    icon: '💡',
    accent: '#f472b6',
    promise: 'Loose and low, near the edge of drifting off.',
    hzLabel: '7 Hz θ/α',
    telemetry: 'L 350 Hz · R 357 Hz · θ/α crossover',
    breath: 'sustain',
    payload: { carrierHz: 350, beatHz: 7 },
  },
  {
    id: 'sympathetic-flare',
    label: 'On Edge',
    name: 'Sympathetic Flare',
    icon: '🤬',
    accent: '#fb923c',
    promise: 'The longest descent — a slow walk down from anger or panic.',
    hzLabel: '15 → 4 Hz',
    telemetry: 'L 400 Hz · R 415→404 Hz over 330 s · brown floor',
    breath: 'extended-exhale',
    payload: {
      carrierHz: 400, beatHz: 15, noise: 'brown',
      glide: { toHz: 4, seconds: 330 },
    },
  },
];

const BY_ID = new Map(NEURO_HACKS.map((h) => [h.id, h]));

export function neuroHackById(id: string): NeuroHack | null {
  return BY_ID.get(id as NeuroHackId) ?? null;
}

export function isNeuroHackId(id: string): id is NeuroHackId {
  return BY_ID.has(id as NeuroHackId);
}
