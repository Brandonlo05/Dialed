/**
 * Gym Mode phase visualizer — all geometry computed per-frame inside
 * Reanimated worklets driving react-native-svg `animatedProps`. Nothing
 * crosses to the JS thread; no `useState` in any frame path.
 *
 * priming  → radial pulse ring, rate tracks the 18→40 Hz climb
 * drive    → high-contrast kinetic waveform (dense, hard-edged)
 * recovery → slow settling wave that visibly decelerates
 */

import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { GymPhase } from '../../services/gymProtocol';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const W = 320;
const H = 150;
const MID = H / 2;

type Props = { phase: GymPhase; hz: number; color: string };

export function PhaseVisualizer({ phase, hz, color }: Props) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = 0;
    // Visible motion floored at 1.2 s/cycle regardless of entrainment rate —
    // a literal 40 Hz visual flicker is photosensitive-seizure territory.
    const period = Math.max(1200, 7000 / Math.max(1, hz));
    clock.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [phase, hz, clock]);

  // ── Radial pulse (priming) ──
  const ringProps = useAnimatedProps(() => {
    'worklet';
    const t = clock.value;
    const grow = 0.5 * (1 - Math.cos(t * Math.PI * 2));
    return { r: 26 + grow * 34, strokeOpacity: 0.85 - grow * 0.55 };
  });
  const ringInnerProps = useAnimatedProps(() => {
    'worklet';
    const t = clock.value;
    const grow = 0.5 * (1 - Math.cos(t * Math.PI * 2));
    return { r: 20 + grow * 8 };
  });

  // ── Waveform (drive + recovery) ──
  const waveProps = useAnimatedProps(() => {
    'worklet';
    const t = clock.value;
    const twoPi = Math.PI * 2;
    const dense = phase === 'drive';
    const cycles = dense ? 7.5 : 2.2;
    const amp = dense ? H * 0.42 : H * 0.3;
    let d = '';
    for (let i = 0; i <= 88; i++) {
      const u = i / 88;
      // Recovery visibly decelerates: amplitude tapers across the sweep
      const decay = dense ? 1 : 0.45 + 0.55 * (1 - u * 0.5);
      const y = MID - Math.sin(u * twoPi * cycles + t * twoPi * 2) * amp * decay;
      d += (i === 0 ? 'M' : 'L') + (u * W).toFixed(2) + ' ' + y.toFixed(2);
    }
    return { d };
  });

  return (
    <View className="items-center">
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={0} y1={MID} x2={W} y2={MID} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

        {phase === 'priming' ? (
          <>
            <AnimatedCircle
              animatedProps={ringProps}
              cx={W / 2}
              cy={MID}
              stroke={color}
              strokeWidth={2}
              fill="none"
            />
            <AnimatedCircle
              animatedProps={ringInnerProps}
              cx={W / 2}
              cy={MID}
              stroke={color}
              strokeOpacity={0.9}
              strokeWidth={3}
              fill="none"
            />
          </>
        ) : (
          <>
            <AnimatedPath
              animatedProps={waveProps}
              stroke={color}
              strokeOpacity={0.22}
              strokeWidth={7}
              fill="none"
              strokeLinecap="round"
            />
            <AnimatedPath
              animatedProps={waveProps}
              stroke={color}
              strokeWidth={phase === 'drive' ? 2.4 : 1.8}
              fill="none"
              strokeLinecap="round"
            />
          </>
        )}
      </Svg>
    </View>
  );
}
