/**
 * Breath pacer — the active-session centrepiece.
 *
 * Deliberately UNBOXED: no card, no border, no bounding rectangle. The ring
 * and its ambient glow bleed to the full width of the screen so the session
 * view reads as an instrument rather than a widget in a list.
 *
 * Hierarchy, top to bottom:
 *   STAGE BANNER   tracked-out sans, high contrast, accent-tinted
 *   instruction    low-opacity muted subhead ("LONG RELEASE")
 *   ⃝ COUNTDOWN    56pt monospace digits inside the ring
 *
 * THREAD DISCIPLINE
 * Ring radius, stroke, glow opacity, banner text, subhead text and the
 * countdown digits are ALL resolved inside Reanimated worklets from a single
 * monotonic clock. Text is mutated through animated TextInput `text` props —
 * the only worklet-safe way to change a string. This component performs ZERO
 * JS re-renders once mounted, and crosses the bridge only on stage change
 * (4× per cycle) to fire haptics.
 */

import { useEffect } from 'react';
import { Dimensions, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { alpha } from '../../constants/theme';
import { playBreathStage, startBreathHaptics, stopBreathHaptics } from '../../services/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const SCREEN_W = Dimensions.get('window').width;
/** Full-bleed stage — the visualizer owns the screen width. */
const STAGE = Math.min(SCREEN_W, 460);
const CX = STAGE / 2;
const R_MIN = STAGE * 0.20;
const R_MAX = STAGE * 0.345;

const STAGE_LABELS = ['INHALE', 'HOLD', 'EXHALE', 'REST'];
/** Instruction subhead — what to actually DO, in plain language. */
const STAGE_HINTS = ['DRAW IN SLOWLY', 'HOLD IT THERE', 'LONG RELEASE', 'STAY EMPTY'];

export type BreathPacerProps = {
  /** [inhale, inhaleHold, exhale, emptyHold] in seconds. Zeros are skipped. */
  cycle: [number, number, number, number];
  /** Mode accent — drives ring, glow and banner tint. */
  color: string;
  paused?: boolean;
  /** Active carrier — mapped to tactile sharpness for the haptic cue. */
  carrierHz?: number;
  /** Drive CoreHaptics so the cycle can be followed with eyes closed. */
  haptics?: boolean;
};

export function BreathPacer({
  cycle,
  color,
  paused = false,
  carrierHz = 200,
  haptics = true,
}: BreathPacerProps) {
  const t = useSharedValue(0);
  const total = Math.max(0.001, cycle[0] + cycle[1] + cycle[2] + cycle[3]);

  useEffect(() => {
    if (paused) {
      cancelAnimation(t);
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(total, { duration: total * 1000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t, total, paused, cycle]);

  // ── Single resolver, reused by every derived value ────────────────────────
  const resolved = useDerivedValue(() => {
    'worklet';
    const c = cycle;
    let x = t.value % total;
    let stage = 0;
    let progress = 0;
    let remaining = 0;
    for (let i = 0; i < 4; i++) {
      if (c[i] <= 0) continue; // zero-length stages never render
      if (x < c[i]) {
        stage = i;
        progress = x / c[i];
        remaining = c[i] - x;
        break;
      }
      x -= c[i];
      stage = i;
      progress = 1;
      remaining = 0;
    }
    // Radius: rise through inhale, hold high, fall through exhale, rest low
    let r: number;
    if (stage === 0) r = R_MIN + (R_MAX - R_MIN) * progress;
    else if (stage === 1) r = R_MAX;
    else if (stage === 2) r = R_MAX - (R_MAX - R_MIN) * progress;
    else r = R_MIN;
    return { stage, progress, remaining, r };
  }, [cycle, total]);

  // ── Ring ──────────────────────────────────────────────────────────────────
  const ringProps = useAnimatedProps(() => {
    'worklet';
    const { stage, r } = resolved.value;
    const wide = stage === 0 || stage === 1;
    return { r, strokeWidth: wide ? 5 : 2.5, strokeOpacity: wide ? 0.95 : 0.5 };
  });

  const haloProps = useAnimatedProps(() => {
    'worklet';
    const { stage, r } = resolved.value;
    const wide = stage === 0 || stage === 1;
    return { r: r + 10, strokeOpacity: wide ? 0.2 : 0.07 };
  });

  /** Ambient radial wash — swells with the breath, never a hard edge. */
  const glowStyle = useAnimatedStyle(() => {
    'worklet';
    const { stage, progress } = resolved.value;
    let g: number;
    if (stage === 0) g = 0.25 + 0.55 * progress;
    else if (stage === 1) g = 0.8;
    else if (stage === 2) g = 0.8 - 0.62 * progress;
    else g = 0.18;
    return { opacity: g, transform: [{ scale: 0.9 + g * 0.22 }] };
  });

  // ── Text (worklet-mutated, zero JS re-renders) ────────────────────────────
  const countProps = useAnimatedProps(() => {
    'worklet';
    const n = Math.max(1, Math.ceil(resolved.value.remaining));
    return { text: n < 10 ? `0${n}` : `${n}` } as never;
  });
  const bannerProps = useAnimatedProps(() => {
    'worklet';
    return { text: STAGE_LABELS[resolved.value.stage] } as never;
  });
  const hintProps = useAnimatedProps(() => {
    'worklet';
    return { text: STAGE_HINTS[resolved.value.stage] } as never;
  });

  // ── Somatic haptics — bridge crossed only on stage change ─────────────────
  useEffect(() => {
    if (!haptics || paused) return;
    startBreathHaptics();
    return () => stopBreathHaptics();
  }, [haptics, paused]);

  useAnimatedReaction(
    () => resolved.value.stage,
    (next, prev) => {
      'worklet';
      if (prev === null || next === prev) return;
      if (!haptics || paused) return;
      runOnJS(playBreathStage)(next, cycle[next], carrierHz);
    },
    [cycle, carrierHz, haptics, paused],
  );

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      {/* ── Stage banner + instruction subhead ── */}
      <AnimatedTextInput
        editable={false}
        animatedProps={bannerProps}
        defaultValue={STAGE_LABELS[0]}
        style={{
          color,
          fontSize: 15,
          fontWeight: '800',
          letterSpacing: 7,
          textAlign: 'center',
          padding: 0,
          width: '100%',
        }}
      />
      <AnimatedTextInput
        editable={false}
        animatedProps={hintProps}
        defaultValue={STAGE_HINTS[0]}
        style={{
          color: 'rgba(255,255,255,0.34)',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 3,
          textAlign: 'center',
          padding: 0,
          marginTop: 5,
          width: '100%',
        }}
      />

      {/* ── Full-bleed ring stage — no card, no border ── */}
      <View style={{ width: STAGE, height: STAGE, marginTop: 10 }}>
        {/* Ambient wash sits behind everything and bleeds outward */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, glowStyle]}
        >
          <Svg width={STAGE} height={STAGE}>
            <Defs>
              <RadialGradient id="breathGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={color} stopOpacity={0.5} />
                <Stop offset="45%" stopColor={color} stopOpacity={0.14} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={CX} cy={CX} r={CX} fill="url(#breathGlow)" />
          </Svg>
        </Animated.View>

        <Svg width={STAGE} height={STAGE}>
          {/* Outer bound reference — barely there, gives the ring context */}
          <Circle
            cx={CX}
            cy={CX}
            r={R_MAX}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
            fill="none"
          />
          <AnimatedCircle animatedProps={haloProps} cx={CX} cy={CX} stroke={color} strokeWidth={12} fill="none" />
          <AnimatedCircle animatedProps={ringProps} cx={CX} cy={CX} stroke={color} fill="none" />
        </Svg>

        {/* ── Massive monospace countdown, centred in the ring ── */}
        <View style={StyleSheet.absoluteFill} className="items-center justify-center">
          <AnimatedTextInput
            editable={false}
            animatedProps={countProps}
            defaultValue="04"
            style={{
              color: '#FFFFFF',
              fontSize: 56,
              lineHeight: 64,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
              fontFamily: 'Menlo',
              textAlign: 'center',
              padding: 0,
              width: STAGE * 0.7,
              textShadowColor: alpha(color, 0.55),
              textShadowRadius: 22,
            }}
          />
        </View>
      </View>
    </View>
  );
}
