/**
 * Breath countdown pacer.
 *
 * A four-stage respiratory cycle [inhale, hold, exhale, rest] rendered as an
 * expanding/contracting ring with a large monospace second counter at its
 * centre and the active stage label above it.
 *
 * THREAD DISCIPLINE
 * The entire cycle — stage selection, remaining seconds, ring radius, label
 * text and the countdown digits — is computed inside Reanimated worklets on
 * the UI thread. The digits and label use the animated-TextInput technique
 * (`animatedProps.text`), which is the only way to mutate text from a
 * worklet; a `useState` counter would re-render the JS tree every second and
 * is exactly what guardrail 4 forbids. This component therefore triggers
 * ZERO JS re-renders once mounted.
 */

import { useEffect } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const SIZE = 240;
const CX = SIZE / 2;
const R_MIN = 52;
const R_MAX = 96;

const STAGE_LABELS = ['INHALE', 'HOLD', 'EXHALE', 'REST'];

export type BreathPacerProps = {
  /** [inhale, inhaleHold, exhale, emptyHold] in seconds. Zeros are skipped. */
  cycle: [number, number, number, number];
  color: string;
  /** Pause the pacer without unmounting. */
  paused?: boolean;
};

export function BreathPacer({ cycle, color, paused = false }: BreathPacerProps) {
  // Single monotonic clock in seconds; every derived value is a pure function
  // of it, so there is no per-stage timer to drift or leak.
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

  /** Resolve the clock to [stageIndex, secondsRemainingInStage, 0..1 progress]. */
  const ringProps = useAnimatedProps(() => {
    'worklet';
    const c = cycle;
    let x = t.value % total;
    let stage = 0;
    let progress = 0;
    for (let i = 0; i < 4; i++) {
      if (c[i] <= 0) continue; // zero-length stages are skipped entirely
      if (x < c[i]) {
        stage = i;
        progress = x / c[i];
        break;
      }
      x -= c[i];
      stage = i;
      progress = 1;
    }

    // Radius: grow through inhale, hold high, shrink through exhale, rest low
    let r: number;
    if (stage === 0) r = R_MIN + (R_MAX - R_MIN) * progress;
    else if (stage === 1) r = R_MAX;
    else if (stage === 2) r = R_MAX - (R_MAX - R_MIN) * progress;
    else r = R_MIN;

    const wide = stage === 0 || stage === 1;
    return { r, strokeWidth: wide ? 4 : 2, strokeOpacity: wide ? 0.9 : 0.45 };
  });

  const countProps = useAnimatedProps(() => {
    'worklet';
    const c = cycle;
    let x = t.value % total;
    let remaining = 0;
    for (let i = 0; i < 4; i++) {
      if (c[i] <= 0) continue;
      if (x < c[i]) {
        remaining = c[i] - x;
        break;
      }
      x -= c[i];
      remaining = 0;
    }
    const n = Math.max(1, Math.ceil(remaining));
    return { text: n < 10 ? `0${n}` : `${n}` } as never;
  });

  const labelProps = useAnimatedProps(() => {
    'worklet';
    const c = cycle;
    let x = t.value % total;
    let stage = 0;
    for (let i = 0; i < 4; i++) {
      if (c[i] <= 0) continue;
      if (x < c[i]) {
        stage = i;
        break;
      }
      x -= c[i];
      stage = i;
    }
    return { text: STAGE_LABELS[stage] } as never;
  });

  return (
    <View className="items-center" style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE}>
        {/* Static track at the outer bound so the ring always reads in context */}
        <Circle cx={CX} cy={CX} r={R_MAX} stroke="rgba(255,255,255,0.07)" strokeWidth={1} fill="none" />
        <AnimatedCircle animatedProps={ringProps} cx={CX} cy={CX} stroke={color} fill="none" />
      </Svg>

      <View style={StyleSheet.absoluteFill} className="items-center justify-center">
        <AnimatedTextInput
          editable={false}
          animatedProps={labelProps}
          defaultValue={STAGE_LABELS[0]}
          style={{
            color,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 3,
            textAlign: 'center',
            padding: 0,
            marginBottom: 2,
          }}
        />
        <AnimatedTextInput
          editable={false}
          animatedProps={countProps}
          defaultValue="04"
          style={{
            color: '#F2F2F7',
            fontSize: 52,
            fontWeight: '900',
            fontVariant: ['tabular-nums'],
            textAlign: 'center',
            padding: 0,
            minWidth: 120,
          }}
        />
      </View>
    </View>
  );
}
