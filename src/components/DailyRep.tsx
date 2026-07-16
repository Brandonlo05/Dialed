/**
 * The Daily Cognitive Rep — high-priority mission card pinned to the top of
 * the dashboard, plus the fullscreen 8-minute conditioning session overlay.
 *
 * Card: 🔥 streak counter, "Day X of 10" neon progress bar, today's protocol
 * line, and the [ START REP ] launcher (or a completed state).
 *
 * Session overlay (Modal): descending 8:00 countdown inside a circular sweep
 * ring, breathing glow, Pause/Resume and Abort. At 0:00 the audio stops, the
 * streak/cycle advance and persist, Focus XP is awarded, and the reward
 * screen fires: "NEURO-CONDITIONING REP COMPLETE — BASELINE VAGAL TONE
 * ENHANCED."
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { NEON } from '../constants/theme';
import {
  completeDailyRep,
  loadDailyRep,
  REP_CYCLE_DAYS,
  REP_DURATION_SEC,
  startRepAudio,
  stopRepAudio,
  type DailyRepStatus,
} from '../services/dailyRep';
import { recordSession, XP_PER_MINUTE } from '../services/gamification';
import { celebrate, engagePreset, tapSelect } from '../services/haptics';
import { getCachedProfile } from '../services/userProfile';

const RING_SIZE = 230;
const RING_STROKE = 9;
const RING_R = (RING_SIZE - RING_STROKE * 2 - 8) / 2;
const RING_C = 2 * Math.PI * RING_R;

type SessionPhase = 'idle' | 'running' | 'paused' | 'complete';

function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type DailyRepProps = {
  /** Dashboard hook — lets it wind down any running session (and bank its XP) first. */
  onBeforeStart?: () => Promise<void> | void;
};

export function DailyRep({ onBeforeStart }: DailyRepProps) {
  const [status, setStatus] = useState<DailyRepStatus | null>(null);
  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [remainingSec, setRemainingSec] = useState(REP_DURATION_SEC);

  const endAtRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef(REP_DURATION_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<SessionPhase>('idle');
  phaseRef.current = phase;

  const breath = useSharedValue(0);

  const refresh = useCallback(() => {
    void loadDailyRep().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Hard teardown if the dashboard unmounts mid-rep
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (phaseRef.current === 'running' || phaseRef.current === 'paused') {
        void stopRepAudio();
      }
    },
    [],
  );

  // Breathing glow while the session runs
  useEffect(() => {
    if (phase === 'running') {
      breath.value = 0;
      breath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(breath);
      breath.value = withTiming(0, { duration: 300 });
    }
  }, [phase, breath]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.025 }],
    shadowOpacity: 0.3 + breath.value * 0.4,
  }));

  // ── Timer plumbing ─────────────────────────────────────────────────────────

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const finishRep = useCallback(async () => {
    clearTimer();
    await stopRepAudio();
    const updated = await completeDailyRep();
    // Rep minutes feed the same XP economy as free sessions
    await recordSession(REP_DURATION_SEC / 60, getCachedProfile()?.goal ?? null);
    setStatus(updated);
    celebrate();
    setPhase('complete');
  }, []);

  const finishRef = useRef(finishRep);
  finishRef.current = finishRep;

  const startTimer = (fromSec: number) => {
    endAtRef.current = Date.now() + fromSec * 1000;
    clearTimer();
    timerRef.current = setInterval(() => {
      const endAt = endAtRef.current;
      if (endAt === null) return;
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) void finishRef.current();
    }, 500);
  };

  // ── Controls ───────────────────────────────────────────────────────────────

  async function startRep() {
    if (!status || status.completedToday) return;
    engagePreset();
    await onBeforeStart?.();
    setRemainingSec(REP_DURATION_SEC);
    setPhase('running');
    await startRepAudio(status.program);
    startTimer(REP_DURATION_SEC);
  }

  async function pauseRep() {
    tapSelect();
    pausedRemainingRef.current = remainingSec;
    clearTimer();
    endAtRef.current = null;
    await stopRepAudio();
    setPhase('paused');
  }

  async function resumeRep() {
    if (!status) return;
    tapSelect();
    setPhase('running');
    await startRepAudio(status.program);
    startTimer(pausedRemainingRef.current);
  }

  async function abortRep() {
    tapSelect();
    clearTimer();
    endAtRef.current = null;
    await stopRepAudio();
    setPhase('idle');
    setRemainingSec(REP_DURATION_SEC);
  }

  function closeComplete() {
    tapSelect();
    setPhase('idle');
    setRemainingSec(REP_DURATION_SEC);
    refresh();
  }

  if (!status) return null;

  const accent = status.program.accent;
  const progressRatio = 1 - remainingSec / REP_DURATION_SEC;
  const sessionOpen = phase !== 'idle';

  return (
    <>
      {/* ── Hero mission card ──────────────────────────────────────────────── */}
      <View
        className="mb-6 overflow-hidden rounded-3xl"
        style={{
          borderWidth: 1.5,
          borderColor: status.completedToday ? `${NEON.green}50` : `${NEON.amber}55`,
          shadowColor: status.completedToday ? NEON.green : NEON.amber,
          shadowOpacity: 0.4,
          shadowRadius: 26,
          shadowOffset: { width: 0, height: 0 },
          elevation: 14,
        }}
      >
        <LinearGradient
          colors={
            status.completedToday
              ? [`${NEON.green}16`, 'rgba(3,6,4,0.98)']
              : [`${NEON.amber}1C`, `${accent}10`, 'rgba(6,4,2,0.98)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-5 py-5"
        >
          <View className="flex-row items-center justify-between">
            <Text
              className="text-[10px] font-bold uppercase tracking-[3.5px]"
              style={{ color: status.completedToday ? NEON.green : NEON.amber }}
            >
              Daily Cognitive Rep
            </Text>
            <View
              className="flex-row items-center rounded-full px-2.5 py-1"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', gap: 4 }}
            >
              <Text allowFontScaling={false} style={{ fontSize: 11 }}>🔥</Text>
              <Text
                className="text-[11px] font-bold text-dialed-stat"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {status.streakCount}-day streak
              </Text>
            </View>
          </View>

          <Text className="mt-3 text-[19px] font-black tracking-tight text-dialed-stat">
            {status.completedToday ? 'Rep Logged — Locked In' : "Today's Rep: " + status.program.title}
          </Text>
          <Text className="mt-1 text-xs text-dialed-muted">
            {status.completedToday
              ? `Day ${status.currentDay} of ${REP_CYCLE_DAYS} complete · next protocol unlocks tomorrow`
              : `${status.program.hz} Hz · 8 min target · Day ${status.currentDay} of ${REP_CYCLE_DAYS}`}
          </Text>

          {/* Neon cycle progress bar */}
          <View className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <View
              className="h-full rounded-full"
              style={{
                width: `${(status.currentDay / REP_CYCLE_DAYS) * 100}%`,
                backgroundColor: status.completedToday ? NEON.green : NEON.amber,
                shadowColor: status.completedToday ? NEON.green : NEON.amber,
                shadowOpacity: 0.9,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
          </View>

          {!status.completedToday && (
            <Pressable
              onPress={() => { void startRep(); }}
              className="mt-4 items-center rounded-2xl py-3.5"
              style={{
                backgroundColor: `${NEON.amber}1F`,
                borderWidth: 1,
                borderColor: `${NEON.amber}60`,
              }}
            >
              <Text
                className="text-[13px] font-black uppercase tracking-[3px]"
                style={{ color: NEON.amber }}
              >
                [ Start Rep ]
              </Text>
            </Pressable>
          )}
        </LinearGradient>
      </View>

      {/* ── Fullscreen session overlay ─────────────────────────────────────── */}
      <Modal transparent={false} visible={sessionOpen} animationType="fade" onRequestClose={() => { void abortRep(); }}>
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#000000' }}>
          {phase === 'complete' ? (
            <Animated.View entering={FadeIn.duration(300)} className="items-center">
              <Text allowFontScaling={false} style={{ fontSize: 44 }}>⚡</Text>
              <Text
                className="mt-6 text-center text-[17px] font-black tracking-[1px]"
                style={{ color: NEON.green }}
              >
                NEURO-CONDITIONING REP COMPLETE
              </Text>
              <Text className="mt-2 text-center text-[11px] uppercase tracking-[2.5px] text-dialed-muted">
                Baseline vagal tone enhanced
              </Text>

              <Animated.View
                entering={FadeInDown.delay(200)}
                className="mt-8 w-full rounded-2xl px-5 py-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.045)', gap: 10 }}
              >
                <View className="flex-row justify-between">
                  <Text className="text-xs uppercase tracking-[2px] text-dialed-muted">Streak</Text>
                  <Text className="text-sm font-bold" style={{ color: NEON.amber }}>
                    🔥 {status.streakCount} {status.streakCount === 1 ? 'day' : 'days'}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs uppercase tracking-[2px] text-dialed-muted">Cycle</Text>
                  <Text className="text-sm font-bold text-dialed-stat">
                    Day {status.currentDay} of {REP_CYCLE_DAYS}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs uppercase tracking-[2px] text-dialed-muted">Focus XP</Text>
                  <Text className="text-sm font-bold" style={{ color: NEON.cyan }}>
                    +{(REP_DURATION_SEC / 60) * XP_PER_MINUTE}
                  </Text>
                </View>
              </Animated.View>

              <Pressable
                onPress={closeComplete}
                className="mt-8 w-full items-center rounded-2xl py-4"
                style={{
                  backgroundColor: `${NEON.green}1F`,
                  borderWidth: 1,
                  borderColor: `${NEON.green}55`,
                }}
              >
                <Text className="text-sm font-bold uppercase tracking-[2px]" style={{ color: NEON.green }}>
                  Continue
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              <Text
                className="text-[10px] font-bold uppercase tracking-[4px]"
                style={{ color: accent }}
              >
                Daily Rep · Day {status.currentDay} of {REP_CYCLE_DAYS}
              </Text>
              <Text className="mt-1 text-[22px] font-black tracking-tight text-dialed-stat">
                {status.program.title}
              </Text>
              <Text className="mt-1 text-[11px] text-dialed-muted">
                {status.program.hz} Hz · {phase === 'paused' ? 'PAUSED' : 'conditioning in progress'}
              </Text>

              {/* Circular sweep countdown */}
              <Animated.View
                className="mt-10"
                style={[
                  {
                    width: RING_SIZE,
                    height: RING_SIZE,
                    shadowColor: accent,
                    shadowRadius: 30,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 14,
                  },
                  breathStyle,
                ]}
              >
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_R}
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth={RING_STROKE}
                    fill="none"
                  />
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_R}
                    stroke={accent}
                    strokeWidth={RING_STROKE}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${RING_C} ${RING_C}`}
                    strokeDashoffset={RING_C * (1 - progressRatio)}
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                    opacity={phase === 'paused' ? 0.35 : 1}
                  />
                </Svg>
                <View className="absolute inset-0 items-center justify-center">
                  <Text
                    allowFontScaling={false}
                    className="font-black tracking-tight text-dialed-stat"
                    style={{ fontSize: 46, fontVariant: ['tabular-nums'] }}
                  >
                    {fmtClock(remainingSec)}
                  </Text>
                  <Text className="text-[10px] uppercase tracking-[3px]" style={{ color: accent }}>
                    {phase === 'paused' ? 'Suspended' : 'Descending'}
                  </Text>
                </View>
              </Animated.View>

              {/* Controls */}
              <View className="mt-12 w-full flex-row" style={{ gap: 12 }}>
                <Pressable
                  onPress={() => { void (phase === 'paused' ? resumeRep() : pauseRep()); }}
                  className="flex-1 items-center rounded-2xl py-3.5"
                  style={{
                    backgroundColor: `${accent}1C`,
                    borderWidth: 1,
                    borderColor: `${accent}55`,
                  }}
                >
                  <Text className="text-xs font-bold uppercase tracking-[2px]" style={{ color: accent }}>
                    {phase === 'paused' ? 'Resume' : 'Pause'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { void abortRep(); }}
                  className="flex-1 items-center rounded-2xl py-3.5"
                  style={{
                    backgroundColor: 'rgba(248,113,113,0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(248,113,113,0.4)',
                  }}
                >
                  <Text className="text-xs font-bold uppercase tracking-[2px]" style={{ color: NEON.red }}>
                    Abort
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}
