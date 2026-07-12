/**
 * Neural Diagnostic Onboarding — 4-step full-screen wizard.
 *
 * - Horizontal step-tracker: all four question cards live in one wide row;
 *   a Reanimated spring on translateX glides between steps (UI thread).
 * - Tapping an option fires a light haptic pop and auto-advances.
 * - After Q4, a 2.5 s "Generating Profile" sequence runs (spinning
 *   neon-gradient arc + cycling technical tickers) before landing on the
 *   dashboard with the recommended program's Command Sheet popped open.
 * - Fully skippable: Skip saves a neutral calibration (or just returns,
 *   when re-running from Settings → Recalibrate).
 *
 * The diagnostic answers are also mapped onto the legacy calibration
 * fields (cognitive/environment/goal) so the audio engine's calibrate()
 * pipeline keeps working unchanged.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import {
  DIAGNOSTIC_QUESTIONS,
  type DiagnosticAnswers,
  type DiagnosticKey,
} from '../src/constants/diagnostic';
import { NEON } from '../src/constants/theme';
import { celebrate, tick } from '../src/services/haptics';
import {
  deriveCalibrationFromDiagnostic,
  getCachedProfile,
  recommendedProgramId,
  saveUserProfile,
  setPendingRecommendation,
} from '../src/services/userProfile';

const { width: SCREEN_W } = Dimensions.get('window');
const STEP_COUNT = DIAGNOSTIC_QUESTIONS.length;

const GENERATING_TICKERS = [
  '◌ ANALYZING AUTONOMIC STRESS VECTOR...',
  '◌ CALIBRATING ENTRAINMENT WAVEFORMS...',
  '● PROFILE LOCKED. OPTIMIZING NEURAL PATHWAYS.',
];
const TICKER_MS = 800;
const GENERATING_MS = 2500;

// ── Generating Profile sequence ──────────────────────────────────────────────

function GeneratingScreen() {
  const [tickerIndex, setTickerIndex] = useState(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 1100, easing: Easing.linear }),
      -1,
    );
    const interval = setInterval(() => {
      setTickerIndex((i) => Math.min(i + 1, GENERATING_TICKERS.length - 1));
    }, TICKER_MS);
    return () => clearInterval(interval);
  }, [spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const locked = tickerIndex === GENERATING_TICKERS.length - 1;

  return (
    <Animated.View entering={FadeIn.duration(300)} className="flex-1 items-center justify-center px-8">
      <Animated.View style={spinStyle}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Defs>
            <SvgLinearGradient id="neonArc" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={NEON.violet} />
              <Stop offset="0.55" stopColor={NEON.cyan} />
              <Stop offset="1" stopColor={NEON.green} />
            </SvgLinearGradient>
          </Defs>
          <Circle cx={60} cy={60} r={52} stroke="rgba(255,255,255,0.07)" strokeWidth={6} fill="none" />
          <Circle
            cx={60}
            cy={60}
            r={52}
            stroke="url(#neonArc)"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="240 87"
          />
        </Svg>
      </Animated.View>

      <Text className="mt-10 text-center text-[17px] font-black tracking-tight text-dialed-stat">
        Generating Neural Profile
      </Text>
      <Text
        className="mt-4 text-center font-mono text-[11px] tracking-[0.5px]"
        style={{ color: locked ? NEON.green : NEON.muted }}
      >
        {GENERATING_TICKERS[tickerIndex]}
      </Text>
    </Animated.View>
  );
}

// ── Wizard ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const isRecalibration = getCachedProfile() !== null;
  const [phase, setPhase] = useState<'wizard' | 'generating'>('wizard');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<DiagnosticAnswers>>({});

  const trackX = useSharedValue(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (finalizeTimer.current) clearTimeout(finalizeTimer.current);
  }, []);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: trackX.value }],
  }));

  function goToStep(index: number) {
    setStepIndex(index);
    trackX.value = withSpring(-index * SCREEN_W, { damping: 21, stiffness: 160 });
  }

  function selectOption(key: DiagnosticKey, optionId: string) {
    tick(); // light haptic pop (ImpactFeedbackStyle.Light)
    const next = { ...answers, [key]: optionId } as Partial<DiagnosticAnswers>;
    setAnswers(next);

    // Brief beat so the selection state visibly registers, then glide on
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      const isLast = stepIndex === STEP_COUNT - 1;
      if (!isLast) {
        goToStep(stepIndex + 1);
      } else {
        setPhase('generating');
        finalizeTimer.current = setTimeout(() => {
          void finalize(next as DiagnosticAnswers);
        }, GENERATING_MS);
      }
    }, 280);
  }

  async function finalize(diagnostic: DiagnosticAnswers) {
    const derived = deriveCalibrationFromDiagnostic(diagnostic);
    await saveUserProfile({
      ...derived,
      diagnostic,
      calibratedAt: new Date().toISOString(),
    });
    setPendingRecommendation(recommendedProgramId(diagnostic.bottleneck));
    celebrate();
    router.replace('/(tabs)');
  }

  async function skip() {
    if (isRecalibration) {
      router.back();
      return;
    }
    // Neutral default so the tabs gate opens; user can recalibrate anytime
    await saveUserProfile({
      cognitive: 'neurotypical',
      environment: 'office-hum',
      goal: 'linear-execution',
      calibratedAt: new Date().toISOString(),
    });
    router.replace('/(tabs)');
  }

  const accent = DIAGNOSTIC_QUESTIONS[stepIndex].accent;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#000000' }}>
      {phase === 'generating' ? (
        <GeneratingScreen />
      ) : (
        <View className="flex-1">
          {/* ── Progress header ──────────────────────────────────────────── */}
          <View className="flex-row items-center justify-between px-6 pt-4">
            <Text
              className="font-mono text-[10px] font-bold tracking-[3px]"
              style={{ color: accent }}
            >
              DIAGNOSTIC {stepIndex + 1} OF {STEP_COUNT}
            </Text>
            <Pressable onPress={() => { void skip(); }} hitSlop={12}>
              <Text className="text-[11px] font-semibold uppercase tracking-[1.5px] text-dialed-muted">
                Skip ✕
              </Text>
            </Pressable>
          </View>
          <View className="mt-3 flex-row px-6" style={{ gap: 6 }}>
            {DIAGNOSTIC_QUESTIONS.map((q, i) => (
              <View
                key={q.key}
                className="h-1 flex-1 rounded-full"
                style={{
                  backgroundColor: i <= stepIndex ? accent : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </View>

          {/* ── Horizontal step tracker ──────────────────────────────────── */}
          <Animated.View
            className="flex-1 flex-row"
            style={[{ width: SCREEN_W * STEP_COUNT }, trackStyle]}
          >
            {DIAGNOSTIC_QUESTIONS.map((q) => {
              const selected = answers[q.key];
              return (
                <View key={q.key} style={{ width: SCREEN_W }} className="px-6 pt-8">
                  <Text
                    className="text-[10px] font-bold uppercase tracking-[4px]"
                    style={{ color: q.accent }}
                  >
                    {q.kicker}
                  </Text>
                  <Text className="mb-7 mt-2 text-[25px] font-black leading-8 tracking-tight text-dialed-stat">
                    {q.question}
                  </Text>

                  {q.options.map((option) => {
                    const isSelected = selected === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => selectOption(q.key, option.id)}
                        className="mb-3 overflow-hidden rounded-2xl"
                        style={{
                          borderWidth: 1,
                          borderColor: isSelected ? q.accent : 'rgba(255,255,255,0.09)',
                          shadowColor: isSelected ? q.accent : '#000',
                          shadowOpacity: isSelected ? 0.5 : 0,
                          shadowRadius: 18,
                          shadowOffset: { width: 0, height: 0 },
                          elevation: isSelected ? 10 : 0,
                        }}
                      >
                        <LinearGradient
                          colors={
                            isSelected
                              ? [`${q.accent}30`, 'rgba(5,5,8,0.97)']
                              : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          className="flex-row items-center px-4 py-4"
                        >
                          <View
                            className="h-10 w-10 items-center justify-center rounded-xl"
                            style={{
                              backgroundColor: isSelected ? `${q.accent}28` : 'rgba(255,255,255,0.06)',
                              borderWidth: 1,
                              borderColor: isSelected ? `${q.accent}55` : 'rgba(255,255,255,0.08)',
                            }}
                          >
                            <Text allowFontScaling={false} style={{ fontSize: 15, color: NEON.text }}>
                              {option.icon}
                            </Text>
                          </View>
                          <View className="ml-3 flex-1">
                            <Text className="text-[15px] font-bold text-dialed-stat">{option.label}</Text>
                            <Text className="mt-0.5 text-[11px] leading-4 text-dialed-muted">
                              {option.desc}
                            </Text>
                          </View>
                          <View
                            className="h-5 w-5 items-center justify-center rounded-full"
                            style={{
                              borderWidth: 1.5,
                              borderColor: isSelected ? q.accent : 'rgba(255,255,255,0.2)',
                              backgroundColor: isSelected ? q.accent : 'transparent',
                            }}
                          >
                            {isSelected && (
                              <Text style={{ color: '#000', fontSize: 11, fontWeight: '900' }}>✓</Text>
                            )}
                          </View>
                        </LinearGradient>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </Animated.View>

          {/* ── Back affordance ──────────────────────────────────────────── */}
          {stepIndex > 0 && (
            <Pressable
              onPress={() => goToStep(stepIndex - 1)}
              className="mb-6 ml-6 self-start rounded-full px-4 py-2"
              style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
              hitSlop={8}
            >
              <Text className="text-[11px] font-semibold text-dialed-muted">← Back</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
