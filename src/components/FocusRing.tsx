/**
 * Neon focus streak ring — the dashboard centerpiece during a live session.
 *
 * - SVG progress arc fills over each 15-minute milestone segment.
 * - Accent color evolves at 15/30/45 min (amber → cyan → violet → green).
 * - The whole ring "breathes" in a slow pulse whose period is derived from
 *   the engine's beat frequency, hard-capped at ≥2.4 s per cycle (≈0.4 Hz)
 *   so it can never approach photosensitive-flash territory.
 */

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { milestoneStage } from '../constants/theme';
import { XP_PER_MINUTE } from '../services/gamification';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 236;
const STROKE = 9;
const R = (SIZE - STROKE * 2 - 8) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const SEGMENT_SEC = 15 * 60;

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type FocusRingProps = {
  elapsedSec: number;
  beatHz: number;
};

export function FocusRing({ elapsedSec, beatHz }: FocusRingProps) {
  const stage = milestoneStage(elapsedSec);
  const progress = useSharedValue(0);
  const breath = useSharedValue(0);

  // Arc progress within the current 15-minute segment
  useEffect(() => {
    progress.value = withTiming((elapsedSec % SEGMENT_SEC) / SEGMENT_SEC, {
      duration: 900,
      easing: Easing.linear,
    });
  }, [elapsedSec, progress]);

  // Breathing pulse — period loosely tracks beat intensity, floor-capped for safety
  useEffect(() => {
    const halfCycleMs = Math.max(1200, 2400 - beatHz * 25);
    breath.value = 0;
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: halfCycleMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: halfCycleMs, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [beatHz, breath]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.028 }],
    shadowOpacity: 0.35 + breath.value * 0.4,
  }));

  const center = SIZE / 2;
  const liveXp = Math.floor(elapsedSec / 60) * XP_PER_MINUTE;

  return (
    <View className="items-center" style={{ marginBottom: 4 }}>
      <Animated.View
        style={[
          {
            width: SIZE,
            height: SIZE,
            shadowColor: stage.color,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: 0 },
            elevation: 16,
          },
          pulseStyle,
        ]}
      >
        <Svg width={SIZE} height={SIZE}>
          {/* Track */}
          <Circle
            cx={center}
            cy={center}
            r={R}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={STROKE}
            fill="none"
          />
          {/* Soft outer glow pass */}
          <AnimatedCircle
            cx={center}
            cy={center}
            r={R}
            stroke={stage.color}
            strokeOpacity={0.25}
            strokeWidth={STROKE + 7}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            animatedProps={arcProps}
            transform={`rotate(-90 ${center} ${center})`}
          />
          {/* Progress arc */}
          <AnimatedCircle
            cx={center}
            cy={center}
            r={R}
            stroke={stage.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            animatedProps={arcProps}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>

        {/* Center readout */}
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ gap: 3 }}
        >
          <Text
            allowFontScaling={false}
            className="font-black tracking-tight text-dialed-stat"
            style={{ fontSize: 44, fontVariant: ['tabular-nums'] }}
          >
            {formatClock(elapsedSec)}
          </Text>
          <Text
            className="text-[10px] font-bold uppercase tracking-[3px]"
            style={{ color: stage.color }}
          >
            {stage.label}
          </Text>
          <Text className="text-[11px] text-dialed-muted" style={{ fontVariant: ['tabular-nums'] }}>
            +{liveXp} XP
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
