/**
 * Premium UX copy frameworks + theme identities for all 7 programs
 * (4 entrainment modes + 3 clinical presets), rendered by the
 * Command Center bottom sheet.
 *
 * Each program carries: the Challenge (pain state), the Neural
 * Intervention (simplified science), the After-State (sensory outcome),
 * a two-color theme, a glow color guaranteed legible on pure black
 * (some theme pairs end in near-black), the ticker's target frequency,
 * and which live-trajectory visualizer the sheet canvas mounts.
 */

import type { NeuroPresetId } from '../services/audioPresets';
import type { FocusModeId } from './modes';

export type ProgramId = FocusModeId | NeuroPresetId;

export type VisualizerVariant =
  | 'decel-sweep'      // Burnout: jagged scarlet decays, clean cyan swells
  | 'gamma-rain'       // Screen Fog: bars fall onto glowing baseline + ripples
  | 'bilateral-split'  // Pre-Exam: L 13 Hz packet / R 10 Hz golden wave
  | 'binaural-drift';  // Modes: two phase-drifting carrier sines

export type ProgramUx = {
  challenge: string;
  science: string;
  afterState: string;
  /** Theme gradient endpoints. */
  themeFrom: string;
  themeTo: string;
  /** Glow/accent color — always bright enough for pure-black grounds. */
  glow: string;
  /** Frequency the LIVE READOUT ticker locks onto. */
  targetHz: number;
  visualizer: VisualizerVariant;
};

export const PRESET_UX_DATA: Record<ProgramId, ProgramUx> = {
  burnout: {
    challenge:
      'You have been grinding for hours under blue light, your heart is racing, your hands are clammy, and your thoughts are looping. You are exhausted but cannot switch off.',
    science:
      "A 600-second piece-wise glide that walks the acoustic pulse from 18 Hz down to 2 Hz, paired with an extended-exhale breath cycle (4-2-8-2). The audio swells on each inhale and recedes on each exhale, so the sound sets the pace and the long exhale does the settling.",
    afterState:
      'A heavy, warm somatic sensation. Your breathing slows down, physical tension in your chest and jaw melts away, and your mind settles into a quiet, calm state—leaving you mentally refreshed.',
    themeFrom: '#FF3366', // Sympathetic Neon Scarlet
    themeTo: '#00E5FF',   // Parasympathetic Vibrant Cyan
    glow: '#00E5FF',
    targetHz: 18,
    visualizer: 'decel-sweep',
  },
  'screen-fog': {
    challenge:
      "Experiencing the '3 PM screen coma' after staring at code or text for six hours. Your eyes are heavy, your temples are throbbing with fatigue, and reading a single line of text feels like wading through wet cement.",
    science:
      'A 400 Hz carrier under crisp 40 Hz isochronic pulses and an unmasked pink-noise floor — an alert, high-contrast texture. Paired with brisk even breathing (4-4) that keeps you clear without winding you down.',
    afterState:
      'Crisp, sharp mental clarity. It feels like stepping out of a dark room into cool morning air—your eyes focus instantly, your reaction times sharpen, and the heavy mental fog is gone.',
    themeFrom: '#39FF14', // Matrix Green
    themeTo: '#0B0C10',   // Deep Obsidian
    glow: '#39FF14',
    targetHz: 40,
    visualizer: 'gamma-rain',
  },
  'pre-exam': {
    challenge:
      'Sitting in the lecture hall waiting for exam papers to be distributed. Your heart is pounding, you are tapping your foot uncontrollably, and you feel a wave of panic that threatens to block your memory.',
    science:
      'True per-ear asymmetry: a 13 Hz amplitude envelope in the left ear, a 10 Hz envelope in the right, so each side carries a distinct rhythm. Paired with 4-7-8 breathing — a long hold and a longer exhale, the pattern people reach for when nerves are already firing.',
    afterState:
      'A state of relaxed alertness and physical stillness. Your hands stop shaking, your breathing patterns stabilize, and your mind feels steady, clear, and confident.',
    themeFrom: '#9D00FF', // Electric Amethyst
    themeTo: '#FFD700',   // Polished Gold
    glow: '#FFD700',
    targetHz: 13,
    visualizer: 'bilateral-split',
  },
  'golden-432': {
    challenge:
      'Almost everything you stream is tuned to A4 = 440 Hz. If you have ever preferred how older or alternately-tuned recordings sit, this is that — generated exactly, not pitch-shifted after the fact.',
    science:
      'An alternative concert tuning: a mathematically exact 432.0 Hz fundamental (−31.77 cents from standard A440), generated from first principles rather than pitch-shifted, with a Pythagorean overtone stack at 108, 216 and 864 Hz. Some listeners simply prefer how this tuning sits; we make no claim beyond that. Paired with slow resonant 6-6 breathing.',
    afterState:
      'A warm, rounded, harmonically stable sound. The overtones sit in whole-number ratios with the fundamental rather than beating against it, which is why it reads as calm rather than busy.',
    themeFrom: '#FFD700', // Polished Gold
    themeTo: '#0B0C10',   // Deep Obsidian
    glow: '#FFD700',
    targetHz: 432,
    visualizer: 'binaural-drift',
  },
  'standard-focus': {
    challenge:
      "You have a four-hour study or work session ahead of you. You don't need intense, frantic pressure, but you need to sit down, ignore surrounding distractions, and maintain steady, comfortable progress.",
    science:
      'A steady 10 Hz acoustic pulse on a 220 Hz carrier — even, unobtrusive, built to disappear into the background. Paired with coherent 5-5 breathing at six breaths a minute, the pacing most consistently linked with steady heart-rate variability.',
    afterState:
      'Steady, friction-free productivity. Time passes quickly without you constantly checking the clock, and you make progress through your task list with minimal mental strain.',
    themeFrom: '#8A2BE2', // Lavender Violet
    themeTo: '#4B0082',   // Translucent Indigo
    glow: '#8A2BE2',
    targetHz: 10,
    visualizer: 'binaural-drift',
  },
  'deep-lockdown': {
    challenge:
      'It is 11 PM, you have a hard deadline in two hours, and you still have hundreds of lines of complex code to write, debug, and push. You need absolute, hyper-alert situational processing right now.',
    science:
      "A fixed 40 Hz pulse on a 200 Hz carrier — the densest, most present texture in the app. Paired with sustained 5-2-5 breathing, an even ratio with a brief hold that is comfortable to keep up for hours.",
    afterState:
      'Laser-guided cognitive tunnel vision. Your workspace feels fully immersive, environmental noise disappears, and you process complex problems at peak speed.',
    themeFrom: '#00F0FF', // High-Voltage Cyan
    themeTo: '#121212',   // Slate Black
    glow: '#00F0FF',
    targetHz: 40,
    visualizer: 'binaural-drift',
  },
  'caffeine-rush': {
    challenge:
      "You woke up groggy, your second cup of coffee isn't hitting, and you are staring blankly at your screen with zero energy or motivation to start your day.",
    science:
      'A brisk 20 Hz pulse on a 240 Hz carrier — bright and forward. Paired with activating 6-2 breathing, where the inhale runs three times the exhale; longer inhales are the side of the breath associated with rousing rather than settling.',
    afterState:
      'Immediate mental acceleration. You feel a surge of cognitive energy, a sharp urge to take action, and a complete clearance of morning lethargy.',
    themeFrom: '#FF007F', // Hot Cyberpunk Pink
    themeTo: '#FF4500',   // Deep Tangerine
    glow: '#FF007F',
    targetHz: 20,
    visualizer: 'binaural-drift',
  },
  'clutch-mode': {
    challenge:
      'You are in a high-pressure, make-or-break situation—a competitive gaming match, a startup pitch, or a high-consequence play. Your thoughts are starting to race, and anxiety is setting in.',
    science:
      'A slow 7 Hz pulse on a 180 Hz carrier, sitting at the theta-alpha boundary. Paired with box breathing (4-4-4-4) — equal on all four sides, the pattern used in high-pressure training precisely because it is easy to hold when everything else is moving fast.',
    afterState:
      'A state of effortless, relaxed control. Everything around you seems to move in slow motion, your motor responses are fast and automatic, and you execute complex tasks with complete confidence.',
    themeFrom: '#0041C2', // Deep Ocean Blue
    themeTo: '#00FF66',   // Neon Emerald
    glow: '#00FF66',
    targetHz: 7,
    visualizer: 'binaural-drift',
  },
};
