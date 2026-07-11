/**
 * Hyper-customized onboarding — three intentional questions that calibrate
 * the native audio engine (see src/services/userProfile.ts for the mapping).
 * Also reachable from Settings → "Recalibrate" once a profile exists.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NEON } from '../src/constants/theme';
import { celebrate, tapConfirm, tapSelect } from '../src/services/haptics';
import {
  getCachedProfile,
  saveUserProfile,
  type CognitiveProfile,
  type Environment,
  type SessionGoal,
} from '../src/services/userProfile';

// ── Step definitions ─────────────────────────────────────────────────────────

type StepKey = 'cognitive' | 'environment' | 'goal';

type Option = { id: string; title: string; desc: string; icon: string };

type Step = {
  key: StepKey;
  kicker: string;
  question: string;
  accent: string;
  options: Option[];
};

const STEPS: Step[] = [
  {
    key: 'cognitive',
    kicker: 'Cognitive Profile',
    question: 'How does your brain naturally handle intense focus?',
    accent: NEON.violet,
    options: [
      { id: 'neurotypical', title: 'Steady Baseline',   desc: 'Standard entrainment curve — no adjustments', icon: '◎' },
      { id: 'adhd',         title: 'Hyper-Active',      desc: 'ADHD pattern — SMR 12–15 Hz stabilization band', icon: '⚡' },
      { id: 'anxiety',      title: 'Prone to Anxiety',  desc: 'Soft carriers capped at 300 Hz + calming theta', icon: '〜' },
      { id: 'fatigue',      title: 'Chronic Fatigue',   desc: 'Gentle alerting lift in the 10–14 Hz band', icon: '☾' },
    ],
  },
  {
    key: 'environment',
    kicker: 'Environmental Chaos',
    question: 'What does your current workspace sound like?',
    accent: NEON.cyan,
    options: [
      { id: 'silent',         title: 'Dead Silent',         desc: 'Low-depth tones — nothing to mask', icon: '◦' },
      { id: 'coffee-shop',    title: 'Coffee Shop Chatter', desc: 'Medium depth to sit above conversation', icon: '☕' },
      { id: 'office-hum',     title: 'Office / Traffic Hum', desc: 'Deeper floor + brown-noise masking layer', icon: '≋' },
      { id: 'creative-chaos', title: 'Creative Chaos',      desc: 'Full-depth immersion wall', icon: '✦' },
    ],
  },
  {
    key: 'goal',
    kicker: 'The Goal Archive',
    question: 'What is your primary objective for this session?',
    accent: NEON.green,
    options: [
      { id: 'linear-execution',  title: 'Linear Coding / Writing',  desc: 'Sustained alpha attention bridge', icon: '⌨' },
      { id: 'rapid-tasks',       title: 'Rapid Task Execution',     desc: 'Beta burst pacing for throughput', icon: '⚡' },
      { id: 'creative-ideation', title: 'Deep Creative Ideation',   desc: 'Theta-alpha drift for divergence', icon: '◇' },
      { id: 'wind-down',         title: 'Nervous System Wind Down', desc: 'Theta ceiling · soft volume floor', icon: '☾' },
    ],
  },
];

// ── Option card ──────────────────────────────────────────────────────────────

function OptionCard({
  option,
  accent,
  selected,
  index,
  onPress,
}: {
  option: Option;
  accent: string;
  selected: boolean;
  index: number;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 70).springify().damping(18)}>
      <Pressable
        onPress={onPress}
        className="mb-3 overflow-hidden rounded-2xl"
        style={{
          borderWidth: 1,
          borderColor: selected ? accent : 'rgba(255,255,255,0.09)',
          shadowColor: selected ? accent : '#000',
          shadowOpacity: selected ? 0.5 : 0,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
          elevation: selected ? 12 : 0,
        }}
      >
        <LinearGradient
          colors={
            selected
              ? [`${accent}30`, 'rgba(5,5,8,0.97)']
              : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="flex-row items-center px-4 py-4"
        >
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{
              backgroundColor: selected ? `${accent}28` : 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: selected ? `${accent}55` : 'rgba(255,255,255,0.08)',
            }}
          >
            <Text allowFontScaling={false} style={{ fontSize: 17 }}>{option.icon}</Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-bold text-dialed-stat">{option.title}</Text>
            <Text className="mt-0.5 text-[11px] leading-4 text-dialed-muted">{option.desc}</Text>
          </View>
          <View
            className="h-5 w-5 items-center justify-center rounded-full"
            style={{
              borderWidth: 1.5,
              borderColor: selected ? accent : 'rgba(255,255,255,0.2)',
              backgroundColor: selected ? accent : 'transparent',
            }}
          >
            {selected && <Text style={{ color: '#000', fontSize: 11, fontWeight: '900' }}>✓</Text>}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const isRecalibration = getCachedProfile() !== null;
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const step = STEPS[stepIndex];
  const selection = answers[step.key];
  const isLast = stepIndex === STEPS.length - 1;

  function selectOption(id: string) {
    tapSelect();
    setAnswers((prev) => ({ ...prev, [step.key]: id }));
  }

  async function advance() {
    if (!selection || saving) return;
    tapConfirm();

    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }

    setSaving(true);
    await saveUserProfile({
      cognitive: answers.cognitive as CognitiveProfile,
      environment: answers.environment as Environment,
      goal: answers.goal as SessionGoal,
      calibratedAt: new Date().toISOString(),
    });
    celebrate();
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: NEON.bg }}>
      <View className="flex-1 px-6">
        {/* ── Progress + close ─────────────────────────────────────────────── */}
        <View className="mb-8 mt-4 flex-row items-center justify-between">
          <View className="flex-row" style={{ gap: 6 }}>
            {STEPS.map((s, i) => (
              <View
                key={s.key}
                className="h-1 rounded-full"
                style={{
                  width: i === stepIndex ? 26 : 12,
                  backgroundColor: i <= stepIndex ? step.accent : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </View>
          {isRecalibration && (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text className="text-lg text-dialed-muted">✕</Text>
            </Pressable>
          )}
        </View>

        {/* ── Question (re-animates on step change via key) ────────────────── */}
        <Animated.View key={step.key} entering={FadeInUp.springify().damping(18)} className="flex-1">
          <Text
            className="text-[10px] font-bold uppercase tracking-[4px]"
            style={{ color: step.accent }}
          >
            {step.kicker} · {stepIndex + 1}/{STEPS.length}
          </Text>
          <Text className="mb-7 mt-2 text-[26px] font-black leading-8 tracking-tight text-dialed-stat">
            {step.question}
          </Text>

          {step.options.map((option, i) => (
            <OptionCard
              key={option.id}
              option={option}
              accent={step.accent}
              selected={selection === option.id}
              index={i}
              onPress={() => selectOption(option.id)}
            />
          ))}
        </Animated.View>

        {/* ── Continue ─────────────────────────────────────────────────────── */}
        <Pressable
          onPress={advance}
          disabled={!selection || saving}
          className="mb-4 items-center rounded-2xl py-4"
          style={{
            backgroundColor: selection ? `${step.accent}22` : 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderColor: selection ? `${step.accent}60` : 'rgba(255,255,255,0.08)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text
            className="text-sm font-bold uppercase tracking-[2px]"
            style={{ color: selection ? step.accent : NEON.muted }}
          >
            {isLast ? 'Calibrate My Engine' : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
