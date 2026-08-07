/**
 * Polymarket-style live trajectory canvas — hardware-accelerated SVG paths
 * whose geometry is computed per-frame inside Reanimated worklets (UI thread,
 * zero JS-thread involvement after mount).
 *
 * Variants:
 * - decel-sweep      Burnout: jagged scarlet trace decays to flatline while a
 *                    clean slow cyan sine swells underneath it.
 * - gamma-rain       Screen Fog: vertical bars fall onto a glowing baseline
 *                    and burst into expanding ground ripples.
 * - bilateral-split  Pre-Exam: split panel — compressed 13 Hz SMR packet on
 *                    the left, broad fluid golden 10 Hz alpha on the right.
 * - binaural-drift   Modes: two phase-drifting carrier sines, wavelength gap
 *                    scaled by the mode's beat frequency.
 */

import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse, Line, Path, Rect } from 'react-native-svg';

import type { VisualizerVariant } from '../../constants/presetUx';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const W = 340;
const H = 150;
const MID = 75;
const TWO_PI = Math.PI * 2;

/** Deterministic pseudo-noise usable inside worklets. */
function noise(i: number, seed: number): number {
  'worklet';
  const n = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// ── Burnout: deceleration sweep ──────────────────────────────────────────────

function DecelSweep({ clock, colorA, colorB }: { clock: SharedValue<number>; colorA: string; colorB: string }) {
  // Path A — sympathetic noise: amplitude interpolates smoothly toward zero
  const jagged = useAnimatedProps(() => {
    const t = clock.value;
    const amp = (1 - t) * 40 + 1.5;
    const scroll = Math.floor(t * 320);
    let d = '';
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * W;
      const y = MID + (noise(i + scroll, 7) - 0.5) * 2 * amp;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return { d, opacity: 0.35 + (1 - t) * 0.65 };
  });

  // Path B — parasympathetic sine: swells from flat into a wide slow roll
  const smooth = useAnimatedProps(() => {
    const t = clock.value;
    const amp = t * 36 + 1.5;
    let d = '';
    for (let i = 0; i <= 64; i++) {
      const x = (i / 64) * W;
      const y = MID + Math.sin((i / 64) * TWO_PI * 1.6 + t * TWO_PI * 2) * amp;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return { d, opacity: 0.3 + t * 0.7 };
  });

  return (
    <>
      <AnimatedPath animatedProps={smooth} stroke={colorB} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <AnimatedPath animatedProps={jagged} stroke={colorA} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
    </>
  );
}

// ── Screen Fog: gamma rain ───────────────────────────────────────────────────

const RAIN_BASE = 116;
const RAIN_COLUMNS = [
  { x: 38, offset: 0.0 },
  { x: 104, offset: 0.37 },
  { x: 170, offset: 0.71 },
  { x: 236, offset: 0.19 },
  { x: 302, offset: 0.55 },
];

function RainColumn({ x, offset, clock, color }: { x: number; offset: number; clock: SharedValue<number>; color: string }) {
  const BAR_LEN = 34;

  const bar = useAnimatedProps(() => {
    const t = (clock.value * 4 + offset) % 1;
    if (t >= 0.5) return { y: RAIN_BASE, opacity: 0 };
    const yTop = -BAR_LEN + (t / 0.5) * RAIN_BASE; // bottom edge lands exactly on the baseline
    return { y: yTop, opacity: 0.4 + (t / 0.5) * 0.55 };
  });

  const ripple = useAnimatedProps(() => {
    const t = (clock.value * 4 + offset) % 1;
    if (t < 0.5) return { rx: 0.5, ry: 0.2, opacity: 0 };
    const rt = (t - 0.5) / 0.5;
    const r = 1 + rt * 30;
    return { rx: r, ry: r * 0.3, opacity: (1 - rt) * 0.85 };
  });

  return (
    <>
      <AnimatedRect animatedProps={bar} x={x - 1.5} width={3} height={BAR_LEN} rx={1.5} fill={color} />
      <AnimatedEllipse animatedProps={ripple} cx={x} cy={RAIN_BASE} stroke={color} strokeWidth={1.4} fill="none" />
    </>
  );
}

function GammaRain({ clock, colorA }: { clock: SharedValue<number>; colorA: string }) {
  return (
    <>
      {/* Glowing baseline vector — soft pass then core */}
      <Line x1={0} y1={RAIN_BASE} x2={W} y2={RAIN_BASE} stroke={colorA} strokeWidth={6} strokeOpacity={0.18} />
      <Line x1={0} y1={RAIN_BASE} x2={W} y2={RAIN_BASE} stroke={colorA} strokeWidth={2} strokeOpacity={0.9} />
      {RAIN_COLUMNS.map((c) => (
        <RainColumn key={c.x} x={c.x} offset={c.offset} clock={clock} color={colorA} />
      ))}
    </>
  );
}

// ── Pre-Exam: bilateral split panel ─────────────────────────────────────────

function BilateralSplit({ clock, colorA, colorB }: { clock: SharedValue<number>; colorA: string; colorB: string }) {
  // Left: compressed rapid SMR wave packet (envelope-shaped)
  const left = useAnimatedProps(() => {
    const t = clock.value;
    let d = '';
    for (let i = 0; i <= 44; i++) {
      const x = (i / 44) * 160;
      const env = Math.sin((i / 44) * Math.PI);
      const y = MID + Math.sin((i / 44) * TWO_PI * 6.5 + t * TWO_PI * 4) * 21 * env;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return { d };
  });

  // Right: broad, fluid golden alpha layer
  const right = useAnimatedProps(() => {
    const t = clock.value;
    let d = '';
    for (let i = 0; i <= 48; i++) {
      const x = 180 + (i / 48) * 160;
      const y = MID + Math.sin((i / 48) * TWO_PI * 2.1 + t * TWO_PI * 2) * 30;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return { d };
  });

  return (
    <>
      <Line x1={170} y1={16} x2={170} y2={H - 16} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="3 5" />
      <AnimatedPath animatedProps={left} stroke={colorA} strokeWidth={2} fill="none" strokeLinecap="round" />
      <AnimatedPath animatedProps={right} stroke={colorB} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </>
  );
}

// ── Modes: binaural drift ───────────────────────────────────────────────────

function BinauralDrift({ clock, colorA, colorB, beatHz }: { clock: SharedValue<number>; colorA: string; colorB: string; beatHz: number }) {
  const cyclesB = 3.2 + Math.min(beatHz, 40) / 16; // visual wavelength gap ∝ beat

  const pathA = useAnimatedProps(() => {
    const t = clock.value;
    let d = '';
    for (let i = 0; i <= 56; i++) {
      const x = (i / 56) * W;
      const y = MID + Math.sin((i / 56) * TWO_PI * 3.2 + t * TWO_PI * 2) * 26;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return { d };
  });

  const pathB = useAnimatedProps(() => {
    const t = clock.value;
    let d = '';
    for (let i = 0; i <= 56; i++) {
      const x = (i / 56) * W;
      const y = MID + Math.sin((i / 56) * TWO_PI * cyclesB + t * TWO_PI * 2.35) * 26;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return { d };
  });

  return (
    <>
      <AnimatedPath animatedProps={pathA} stroke={colorA} strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.95} />
      <AnimatedPath animatedProps={pathB} stroke={colorB} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.6} />
    </>
  );
}

// ── Canvas ───────────────────────────────────────────────────────────────────

type TrajectoryGraphProps = {
  variant: VisualizerVariant;
  colorA: string;
  colorB: string;
  beatHz?: number;
};

export function TrajectoryGraph({ variant, colorA, colorB, beatHz = 10 }: TrajectoryGraphProps) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [variant, clock]);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Faint market grid */}
      {[30, 75, 120].map((y) => (
        <Line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}
      {[68, 136, 204, 272].map((x) => (
        <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
      ))}

      {variant === 'decel-sweep' && <DecelSweep clock={clock} colorA={colorA} colorB={colorB} />}
      {variant === 'gamma-rain' && <GammaRain clock={clock} colorA={colorA} />}
      {variant === 'bilateral-split' && <BilateralSplit clock={clock} colorA={colorA} colorB={colorB} />}
      {variant === 'binaural-drift' && (
        <BinauralDrift clock={clock} colorA={colorA} colorB={colorB} beatHz={beatHz} />
      )}
    </Svg>
  );
}
