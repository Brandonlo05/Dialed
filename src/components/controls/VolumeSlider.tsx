/**
 * Engine Volume Slider with Hearing Safety Threshold Warning.
 *
 * Above SAFETY_THRESHOLD (70%) the control shifts into a clinical
 * high-gain warning state:
 *  1. the track and thumb morph from Dialed violet to Cyberpunk Amber
 *     (interpolateColor, UI-thread worklets),
 *  2. a pulsing warning triangle fades in beside the percentage readout,
 *  3. an inline alert card slides open below the slider
 *     (height + opacity interpolated via Reanimated),
 *  4. a firmer haptic notch (impact Medium) fires the moment the thumb
 *     crosses the 70% boundary, in either direction.
 *
 * The warning layer is purely visual/haptic — it never caps or alters the
 * gain actually written to the native engine, and it never touches channel
 * routing or modulation. All animations are shared-value driven and run on
 * the native UI thread at display refresh rate.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { NEON } from '../../constants/theme';
import { getLastVolume, setVolume } from '../../services/audioEngine';
import { notch, tick } from '../../services/haptics';

/** Hearing-safety ceiling: volumes above this trigger the high-gain state. */
export const SAFETY_THRESHOLD = 0.7;

const WARN_COLOR = '#FF9900';
const ALERT_HEIGHT = 118;

const WARNING_COPY =
  '⚠️ HIGH GAIN WARNING: Frequencies are optimized for low-to-medium volumes. ' +
  'Listening above 70% volume may cause neural over-stimulation or acoustic fatigue. ' +
  'Lower levels are recommended for optimal entrainment.';

export function VolumeSlider() {
  const [percent, setPercent] = useState(() => Math.round(getLastVolume() * 100));
  const [isOverThreshold, setIsOverThreshold] = useState(() => percent / 100 > SAFETY_THRESHOLD);

  // 0 = safe zone, 1 = high-gain zone — drives every visual mutation
  const warn = useSharedValue(isOverThreshold ? 1 : 0);
  const pulse = useSharedValue(0);

  const widthRef = useRef(1);
  const percentRef = useRef(percent);
  percentRef.current = percent;

  // Latest-handler ref so the PanResponder (created once) never goes stale
  const touchRef = useRef<(x: number) => void>(() => {});
  touchRef.current = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    const next = Math.round(ratio * 100);
    const prev = percentRef.current;
    if (next === prev) return;

    const wasOver = prev / 100 > SAFETY_THRESHOLD;
    const nowOver = next / 100 > SAFETY_THRESHOLD;

    if (wasOver !== nowOver) {
      // Physical resistance cue at exactly the 70% boundary
      notch();
      setIsOverThreshold(nowOver);
      warn.value = withTiming(nowOver ? 1 : 0, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    } else if (next % 5 === 0) {
      tick(); // light mechanical detent every 5%
    }

    setPercent(next);
    // Gain write only — channel routing and modulation are untouched
    void setVolume(next / 100);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => touchRef.current(e.nativeEvent.locationX),
      onPanResponderMove: (e) => touchRef.current(e.nativeEvent.locationX),
    }),
  ).current;

  // Pulse loop for the warning triangle while inside the high-gain zone
  useEffect(() => {
    if (isOverThreshold) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 620, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: 620, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [isOverThreshold, pulse]);

  // ── Animated styles (all UI-thread) ─────────────────────────────────────
  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(warn.value, [0, 1], [NEON.violet, WARN_COLOR]),
    shadowColor: interpolateColor(warn.value, [0, 1], [NEON.violet, WARN_COLOR]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(warn.value, [0, 1], [NEON.violet, WARN_COLOR]),
    shadowColor: interpolateColor(warn.value, [0, 1], [NEON.violet, WARN_COLOR]),
  }));
  const readoutStyle = useAnimatedStyle(() => ({
    color: interpolateColor(warn.value, [0, 1], [NEON.text, WARN_COLOR]),
  }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));
  const alertStyle = useAnimatedStyle(() => ({
    height: interpolate(warn.value, [0, 1], [0, ALERT_HEIGHT]),
    opacity: warn.value,
    marginTop: interpolate(warn.value, [0, 1], [0, 10]),
  }));

  const ratio = percent / 100;

  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl"
      style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' }}
    >
      <View className="px-4 py-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
        {/* Label + readout row */}
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold text-dialed-stat">Engine Volume</Text>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Animated.View style={iconStyle}>
              <Ionicons name="warning" size={13} color={WARN_COLOR} />
            </Animated.View>
            <Animated.Text
              className="text-sm font-bold"
              style={[{ fontVariant: ['tabular-nums'] }, readoutStyle]}
            >
              {percent}%
            </Animated.Text>
          </View>
        </View>
        <Text className="mt-0.5 text-xs leading-[18px] text-dialed-muted">
          Master gain for the synthesis engine — applies live to a running session
        </Text>

        {/* Track */}
        <View
          {...pan.panHandlers}
          onLayout={(e) => { widthRef.current = Math.max(1, e.nativeEvent.layout.width); }}
          className="mt-2 justify-center"
          style={{ height: 36 }}
        >
          <View
            className="rounded-full"
            style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.07)' }}
          />
          {/* 70% threshold marker etched into the rail */}
          <View
            className="absolute h-2.5 w-px"
            style={{ left: `${SAFETY_THRESHOLD * 100}%`, backgroundColor: 'rgba(255,255,255,0.42)', height: 14, width: 1.5 }}
          />
          <Animated.View
            className="absolute rounded-full"
            style={[
              {
                height: 6,
                width: `${ratio * 100}%`,
                shadowOpacity: 0.8,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              },
              fillStyle,
            ]}
          />
          <Animated.View
            className="absolute rounded-full"
            style={[
              {
                width: 20,
                height: 20,
                left: `${ratio * 100}%`,
                marginLeft: -10,
                backgroundColor: '#0a0a0f',
                borderWidth: 2.5,
                shadowOpacity: 1,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
                elevation: 8,
              },
              thumbStyle,
            ]}
          />
        </View>

        {/* Expansible inline alert — slides open past the threshold */}
        <Animated.View style={[{ overflow: 'hidden' }, alertStyle]}>
          <View
            className="rounded-xl px-3.5 py-3"
            style={{
              backgroundColor: 'rgba(255,153,0,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(255,153,0,0.4)',
            }}
          >
            <Text className="text-[11px] leading-[17px]" style={{ color: '#ffb84d' }}>
              {WARNING_COPY}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
