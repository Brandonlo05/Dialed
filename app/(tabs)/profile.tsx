import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NEON } from '../../src/constants/theme';
import {
  levelForXp,
  loadGamification,
  nextUnlock,
  PAD_UNLOCKS,
  progressToNextLevel,
  xpToReachLevel,
  type GamificationState,
} from '../../src/services/gamification';

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <View
      className="flex-1 overflow-hidden rounded-2xl"
      style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', margin: 4 }}
    >
      <LinearGradient colors={[`${accent}14`, 'rgba(5,5,8,0.97)']} className="p-4">
        <Text
          allowFontScaling={false}
          className="text-[22px] font-black leading-none"
          style={{ color: accent }}
        >
          {value}
        </Text>
        <Text className="mt-1 text-[10px] font-bold uppercase tracking-[1.5px] text-dialed-stat">
          {label}
        </Text>
        <Text className="mt-0.5 text-[10px] leading-tight text-dialed-muted">{sub}</Text>
      </LinearGradient>
    </View>
  );
}

function formatTotalTime(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

export default function ProfileScreen() {
  const [state, setState] = useState<GamificationState | null>(null);

  // Reload whenever the tab regains focus so post-session numbers are fresh
  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadGamification().then((s) => { if (live) setState(s); });
      return () => { live = false; };
    }, []),
  );

  const totalXp = state?.totalXp ?? 0;
  const level = levelForXp(totalXp);
  const progress = progressToNextLevel(totalXp);
  const next = nextUnlock(level);
  const xpForNext = xpToReachLevel(level + 1);

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Progression
          </Text>
          <Text className="mt-0.5 text-[28px] font-black tracking-tight text-dialed-stat">
            Profile
          </Text>
        </View>

        {/* ── Level hero ───────────────────────────────────────────────────── */}
        <View
          className="mb-6 overflow-hidden rounded-3xl"
          style={{
            borderWidth: 1,
            borderColor: `${NEON.violet}40`,
            shadowColor: NEON.violet,
            shadowOpacity: 0.35,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 0 },
            elevation: 12,
          }}
        >
          <LinearGradient colors={[`${NEON.violet}1A`, 'rgba(4,4,8,0.98)']} className="items-center px-5 py-7">
            <View
              className="h-24 w-24 items-center justify-center rounded-full"
              style={{
                borderWidth: 2,
                borderColor: `${NEON.violet}70`,
                backgroundColor: `${NEON.violet}12`,
              }}
            >
              <Text
                allowFontScaling={false}
                className="font-black text-dialed-stat"
                style={{ fontSize: 38, lineHeight: 42 }}
              >
                {level}
              </Text>
              <Text className="text-[9px] font-bold uppercase tracking-[2px]" style={{ color: NEON.violetSoft }}>
                Level
              </Text>
            </View>

            {/* XP bar */}
            <View className="mt-5 w-full">
              <View className="flex-row justify-between">
                <Text className="text-[10px] font-bold uppercase tracking-[1.5px] text-dialed-muted">
                  Focus XP
                </Text>
                <Text className="text-[10px] text-dialed-muted" style={{ fontVariant: ['tabular-nums'] }}>
                  {totalXp} / {xpForNext}
                </Text>
              </View>
              <View
                className="mt-1.5 h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.round(progress * 100))}%`,
                    backgroundColor: NEON.violet,
                  }}
                />
              </View>
              {next && (
                <Text className="mt-1.5 text-[10px] text-dialed-muted">
                  Level {next.level} unlocks “{next.name}”
                </Text>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* ── Session metrics ─────────────────────────────────────────────── */}
        <Text className="mb-1 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Session History
        </Text>
        <View className="flex-row" style={{ margin: -4, marginBottom: 0 }}>
          <MetricCard
            label="Sessions"
            value={String(state?.sessionsCompleted ?? 0)}
            sub="Completed"
            accent={NEON.violet}
          />
          <MetricCard
            label="Deep Time"
            value={formatTotalTime(state?.totalMinutes ?? 0)}
            sub="Cumulative"
            accent={NEON.teal}
          />
        </View>
        <View className="flex-row" style={{ margin: -4 }}>
          <MetricCard
            label="Streak"
            value={`${state?.streakDays ?? 0}d`}
            sub="Days active"
            accent={NEON.amber}
          />
          <MetricCard
            label="Vault"
            value={`${PAD_UNLOCKS.filter((p) => p.level <= level).length}/${PAD_UNLOCKS.length}`}
            sub="Pads unlocked"
            accent={NEON.pink}
          />
        </View>

        {/* ── Sound vault ─────────────────────────────────────────────────── */}
        <Text className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Sound Vault
        </Text>
        {PAD_UNLOCKS.map((pad) => {
          const unlocked = pad.level <= level;
          return (
            <View
              key={pad.name}
              className="mb-2.5 flex-row items-center overflow-hidden rounded-2xl px-4 py-3"
              style={{
                borderWidth: 1,
                borderColor: unlocked ? `${NEON.violet}40` : 'rgba(255,255,255,0.07)',
                backgroundColor: unlocked ? `${NEON.violet}0E` : 'rgba(255,255,255,0.025)',
                opacity: unlocked ? 1 : 0.55,
                gap: 12,
              }}
            >
              <Text allowFontScaling={false} style={{ fontSize: 16 }}>
                {unlocked ? '♬' : '🔒'}
              </Text>
              <View className="flex-1">
                <Text className="text-sm font-bold text-dialed-stat">{pad.name}</Text>
                <Text className="text-[11px] text-dialed-muted">{pad.flavor}</Text>
              </View>
              <Text
                className="text-[10px] font-bold uppercase tracking-[1px]"
                style={{ color: unlocked ? NEON.violetSoft : NEON.muted }}
              >
                {unlocked ? 'Unlocked' : `Lv ${pad.level}`}
              </Text>
            </View>
          );
        })}

        {/* ── Apple Watch card ────────────────────────────────────────────── */}
        <View
          className="mt-4 overflow-hidden rounded-2xl"
          style={{ borderWidth: 1, borderColor: 'rgba(94,234,212,0.15)' }}
        >
          <LinearGradient
            colors={['rgba(94,234,212,0.08)', 'rgba(4,4,8,0.98)']}
            className="p-5"
          >
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <Text allowFontScaling={false} style={{ fontSize: 28 }}>
                ⌚
              </Text>
              <View className="flex-1">
                <Text className="font-bold text-dialed-stat">Apple Watch</Text>
                <Text className="mt-0.5 text-xs leading-[18px] text-dialed-muted">
                  Live HRV recovery scoring · replaces estimates with real biometrics
                </Text>
              </View>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-[1px] text-dialed-muted">
                  Soon
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
