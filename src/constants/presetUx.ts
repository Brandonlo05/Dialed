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
      'You have been grinding for hours under blue light, your heart is racing, your hands are clammy, and your thoughts are looping. Your brain is still spinning at high-beta speeds, leaving you locked in exhausting sympathetic overdrive.',
    science:
      "This preset acts as a step-by-step decelerator for your brain's electrical pacing, capturing your hyper-aroused neural state at 18 Hz and systematically pulling it down to 2 Hz in a piece-wise linear glide.",
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
      'Delivers a 400 Hz acoustic carrier wave overlaid with hardcoded 40 Hz Gamma isochronic pulses over unmasked pink noise to drive high-frequency synchronization across your visual and parietal networks.',
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
      'Uses asymmetric multi-channel isolation. The left ear receives a 13 Hz SMR envelope to stabilize the motor strip and suppress physical jitters, while the right ear receives a coherent 10 Hz Alpha wave to down-regulate lateral amygdala activity.',
    afterState:
      'A state of relaxed alertness and physical stillness. Your hands stop shaking, your breathing patterns stabilize, and your mind feels steady, clear, and confident.',
    themeFrom: '#9D00FF', // Electric Amethyst
    themeTo: '#FFD700',   // Polished Gold
    glow: '#FFD700',
    targetHz: 13,
    visualizer: 'bilateral-split',
  },
  'standard-focus': {
    challenge:
      "You have a four-hour study or work session ahead of you. You don't need intense, frantic pressure, but you need to sit down, ignore surrounding distractions, and maintain steady, comfortable progress.",
    science:
      'This mode establishes a stable, continuous 10 Hz Alpha wave bridge across your cortex. This classic state of relaxed alertness suppresses sensory distractions and acts as a gateway to cognitive endurance.',
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
      "This mode entrains your cortical networks to a fixed 40 Hz Gamma wave—the brain's highest information-processing band, coordinating rapid, multi-regional communication.",
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
      "Delivers a high-intensity 20 Hz High-Beta frequency burst to your auditory pathways to rapidly stimulate your brain's noradrenergic and dopaminergic alerting networks without a crash.",
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
      'This preset targets the precise 7 Hz Theta-Alpha crossover boundary, keeping your brainwaves positioned between calm visualization and relaxed awareness to keep physical reflexes rapid while silencing mental chatter.',
    afterState:
      'A state of effortless, relaxed control. Everything around you seems to move in slow motion, your motor responses are fast and automatic, and you execute complex tasks with complete confidence.',
    themeFrom: '#0041C2', // Deep Ocean Blue
    themeTo: '#00FF66',   // Neon Emerald
    glow: '#00FF66',
    targetHz: 7,
    visualizer: 'binaural-drift',
  },
};
