/**
 * ACTIVE PROTOCOL ENGINE — the dashboard's single dominant surface.
 *
 * Merges what were previously two competing cards (the tailored-protocol
 * hero and the standalone FocusRing) into one glassmorphic cockpit panel:
 *
 *   IDLE      → protocol identity, tailored copy, telemetry strip, CTA
 *   ENGAGED   → milestone sweep ring + session clock + live waveform
 *
 * The waveform is computed per-frame inside Reanimated worklets driving
 * react-native-svg `animatedProps` — geometry never crosses to the JS
 * thread, and the audio render callback is never touched. Carrier and
 * modulation values only parameterize the drawing; they are read, never
 * written.
 *
 * Visual grounds are pure #000000 for OLED contrast; the accent glow is
 * the only chromatic element, keyed to the active protocol.
 */

import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { BreathPattern } from '../constants/breathwork';
import { milestoneStage, NEON } from '../constants/theme';
import { XP_PER_MINUTE } from '../services/gamification';
import { BreathPacer } from './neuro-visualizers/BreathPacer';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Geometry ─────────────────────────────────────────────────────────────────

const RING = 244;
const STROKE = 8;
const R = (RING - STROKE * 2 - 10) / 2;
const CIRC = 2 * Math.PI * R;
const SEGMENT_SEC = 15 * 60;

const WAVE_W = 300;
const WAVE_H = 74;
const WAVE_MID = WAVE_H / 2;
const WAVE_PTS = 72;

function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Live waveform (all geometry on the UI thread) ───────────────────────────

type WaveformProps = {
  /** Acoustic carrier in Hz — sets visual wavelength density. */
  carrierHz: number;
  /** Modulation / beat rate in Hz — sets envelope and scroll rate. */
  modHz: number;
  /** True when the Pythagorean overtone stack is active (432 preset). */
  overtones: boolean;
  color: string;
};

function ProtocolWaveform({ carrierHz, modHz, overtones, color }: WaveformProps) {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = 0;
    // Scroll period tracks the modulation rate but is floored at 1.4 s so the
    // visible motion can never approach photosensitive-flash territory.
    const period = Math.max(1400, 9000 / Math.max(1, modHz));
    clock.value = withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [carrierHz, modHz, clock]);

  // Cycles across the viewport, scaled log-wise so a 432 Hz carrier reads
  // denser than 200 Hz without collapsing into aliasing hash.
  const cycles = Math.min(9, 2.4 + Math.log2(Math.max(50, carrierHz) / 50) * 1.35);
  const envCycles = Math.min(3.2, 0.9 + modHz / 26);

  const waveProps = useAnimatedProps(() => {
    'worklet';
    const t = clock.value;
    const twoPi = Math.PI * 2;
    let d = '';
    for (let i = 0; i <= WAVE_PTS; i++) {
      const x = (i / WAVE_PTS) * WAVE_W;
      const u = i / WAVE_PTS;
      // Raised-cosine envelope mirrors the engine's AM shape (visual only)
      const env = 0.42 + 0.58 * (0.5 * (1 - Math.cos(u * twoPi * envCycles + t * twoPi)));
      let y = Math.sin(u * twoPi * cycles + t * twoPi * 2);
      if (overtones) {
        // Pythagorean partials: f/2 and 2f contributions, matching weights
        y = y + 0.4 * Math.sin(u * twoPi * (cycles / 2) + t * twoPi * 2)
              + 0.15 * Math.sin(u * twoPi * cycles * 2 + t * twoPi * 2);
        y *= 0.66;
      }
      const py = WAVE_MID - y * env * (WAVE_H * 0.4);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + py.toFixed(2);
    }
    return { d };
  });

  const glowProps = useAnimatedProps(() => {
    'worklet';
    return { d: waveProps.d as string };
  });

  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}>
      <Line
        x1={0}
        y1={WAVE_MID}
        x2={WAVE_W}
        y2={WAVE_MID}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1}
      />
      <AnimatedPath
        animatedProps={glowProps}
        stroke={color}
        strokeOpacity={0.22}
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
      />
      <AnimatedPath
        animatedProps={waveProps}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export type ActiveProtocolEngineProps = {
  /** Personalized protocol title (from the copy matrix). */
  title: string;
  /** Personalized mechanism line. */
  subtitle: string;
  accent: string;
  /** Entrainment / modulation rate in Hz. */
  targetHz: number;
  /** Acoustic carrier in Hz. */
  carrierHz: number;
  /** Pythagorean overtone stack engaged (Golden Frequency). */
  overtones?: boolean;
  isPlaying: boolean;
  elapsedSec: number;
  /** Respiratory pattern paired with this program (shown while running). */
  breathPattern?: BreathPattern | null;
  /** Optional status line shown while engaged (e.g. Burnout phase). */
  statusLine?: string | null;
  onEngage: () => void;
  onStop: () => void;
};

export function ActiveProtocolEngine({
  title,
  subtitle,
  accent,
  targetHz,
  carrierHz,
  overtones = false,
  isPlaying,
  elapsedSec,
  breathPattern = null,
  statusLine,
  onEngage,
  onStop,
}: ActiveProtocolEngineProps) {
  const stage = milestoneStage(elapsedSec);
  const ringColor = isPlaying ? stage.color : accent;

  const progress = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming((elapsedSec % SEGMENT_SEC) / SEGMENT_SEC, {
      duration: 900,
      easing: Easing.linear,
    });
  }, [elapsedSec, progress]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 300 });
      return;
    }
    const half = Math.max(1300, 2400 - targetHz * 22);
    breath.value = 0;
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(breath);
  }, [isPlaying, targetHz, breath]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  const auraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.022 }],
    shadowOpacity: 0.3 + breath.value * 0.4,
  }));

  const liveXp = Math.floor(elapsedSec / 60) * XP_PER_MINUTE;
  const center = RING / 2;

  return (
    <View
      className="mb-6 overflow-hidden rounded-3xl"
      style={{
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: isPlaying ? `${ringColor}45` : 'rgba(255,255,255,0.08)',
        shadowColor: ringColor,
        shadowOpacity: isPlaying ? 0.4 : 0.16,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 0 },
        elevation: isPlaying ? 16 : 6,
      }}
    >
      <View
        className="px-5 pb-5 pt-4"
        style={{ backgroundColor: 'rgba(20,20,22,0.65)' }}
      >
        {/* ── Header strip ─────────────────────────────────────────────── */}
        <View className="flex-row items-center justify-between">
          <Text
            className="text-[10px] font-bold uppercase tracking-[3.5px]"
            style={{ color: isPlaying ? ringColor : NEON.muted }}
          >
            Active Protocol Engine
          </Text>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: isPlaying ? ringColor : 'rgba(255,255,255,0.2)' }}
            />
            <Text
              className="font-mono text-[10px] font-bold"
              style={{ color: isPlaying ? ringColor : NEON.muted, fontVariant: ['tabular-nums'] }}
            >
              {isPlaying ? 'ENGAGED' : 'STANDBY'}
            </Text>
          </View>
        </View>

        {/* ── Identity ─────────────────────────────────────────────────── */}
        <Text className="mt-2.5 text-[23px] font-black tracking-tight text-dialed-stat">
          {title}
        </Text>
        <Text className="mt-1 text-xs leading-[19px] text-dialed-muted">
          {statusLine ?? subtitle}
        </Text>

        {/* ── Telemetry strip (monospace precision row) ─────────────────── */}
        <View
          className="mt-3.5 flex-row items-center rounded-xl px-3 py-2"
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderWidth: 1,
            borderColor: '#1A1A1E',
            gap: 14,
          }}
        >
          <Text className="font-mono text-[10px]" style={{ color: accent, fontVariant: ['tabular-nums'] }}>
            {targetHz.toFixed(1)} HZ
          </Text>
          <Text className="font-mono text-[10px] text-dialed-muted" style={{ fontVariant: ['tabular-nums'] }}>
            CARRIER {Math.round(carrierHz)}
          </Text>
          {overtones && (
            <Text className="font-mono text-[10px]" style={{ color: '#FFD700' }}>
              OT·STACK
            </Text>
          )}
          {isPlaying && (
            <Text
              className="ml-auto font-mono text-[10px]"
              style={{ color: ringColor, fontVariant: ['tabular-nums'] }}
            >
              +{liveXp} XP
            </Text>
          )}
        </View>

        {/* ── Waveform (standby, and while running without a pattern) ──── */}
        {!(isPlaying && breathPattern) && (
          <View className="mt-3">
            <ProtocolWaveform
              carrierHz={carrierHz}
              modHz={targetHz}
              overtones={overtones}
              color={isPlaying ? ringColor : accent}
            />
          </View>
        )}

        {/* ── Running: ONE focal circle — the breath pacer — plus a compact
             clock row. Stacking the pacer on top of the milestone ring put
             two large circles in one card and read as noise. ──────────── */}
        {isPlaying && breathPattern && (
          <View className="mt-2 items-center">
            <BreathPacer cycle={breathPattern.cycle} color={ringColor} carrierHz={carrierHz} />
            <Text
              className="mt-1 font-mono text-[10px] tracking-[1.5px]"
              style={{ color: NEON.muted }}
            >
              {breathPattern.name.toUpperCase()}
            </Text>
            <View className="mt-3 flex-row items-center" style={{ gap: 10 }}>
              <Text
                allowFontScaling={false}
                className="font-black tracking-tight text-dialed-stat"
                style={{ fontSize: 28, fontVariant: ['tabular-nums'] }}
              >
                {fmtClock(elapsedSec)}
              </Text>
              <View
                className="rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: `${ringColor}16`,
                  borderWidth: 1,
                  borderColor: `${ringColor}40`,
                }}
              >
                <Text
                  className="text-[9.5px] font-bold uppercase tracking-[2px]"
                  style={{ color: ringColor }}
                >
                  {stage.label}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Engaged without a breath pattern: milestone sweep ring ────── */}
        {isPlaying && !breathPattern && (
          <View className="mt-1 items-center">
            <Animated.View
              style={[
                {
                  width: RING,
                  height: RING,
                  shadowColor: ringColor,
                  shadowRadius: 30,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 14,
                },
                auraStyle,
              ]}
            >
              <Svg width={RING} height={RING}>
                <Circle
                  cx={center}
                  cy={center}
                  r={R}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={STROKE}
                  fill="none"
                />
                <AnimatedCircle
                  cx={center}
                  cy={center}
                  r={R}
                  stroke={ringColor}
                  strokeOpacity={0.24}
                  strokeWidth={STROKE + 7}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${CIRC} ${CIRC}`}
                  animatedProps={arcProps}
                  transform={`rotate(-90 ${center} ${center})`}
                />
                <AnimatedCircle
                  cx={center}
                  cy={center}
                  r={R}
                  stroke={ringColor}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${CIRC} ${CIRC}`}
                  animatedProps={arcProps}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              </Svg>
              <View className="absolute inset-0 items-center justify-center" style={{ gap: 2 }}>
                <Text
                  allowFontScaling={false}
                  className="font-black tracking-tight text-dialed-stat"
                  style={{ fontSize: 46, fontVariant: ['tabular-nums'] }}
                >
                  {fmtClock(elapsedSec)}
                </Text>
                <Text
                  className="text-[10px] font-bold uppercase tracking-[3px]"
                  style={{ color: ringColor }}
                >
                  {stage.label}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* ── Control ──────────────────────────────────────────────────── */}
        <Pressable
          onPress={isPlaying ? onStop : onEngage}
          className="mt-4 items-center rounded-2xl py-4"
          style={{
            backgroundColor: isPlaying ? 'rgba(248,113,113,0.1)' : `${accent}1C`,
            borderWidth: 1,
            borderColor: isPlaying ? 'rgba(248,113,113,0.38)' : `${accent}55`,
          }}
        >
          <Text
            className="text-[13px] font-black uppercase tracking-[3px]"
            style={{ color: isPlaying ? NEON.red : accent }}
          >
            {isPlaying ? 'Disengage' : 'Engage Protocol'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
