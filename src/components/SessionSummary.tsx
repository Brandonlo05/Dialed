/**
 * Micro-reward splash card — shown once when a session ends.
 * Minimal, fast, celebratory without yanking the user around.
 *
 * "Somatic Stillness" is a deterministic estimate (no live biometrics yet)
 * and is labeled as such in the UI.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { NEON } from '../constants/theme';
import type { SessionSummaryData } from '../services/gamification';
import { celebrate } from '../services/haptics';

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="text-xs uppercase tracking-[2px] text-dialed-muted">{label}</Text>
      <Text className="text-base font-bold" style={{ color: accent ?? NEON.text }}>
        {value}
      </Text>
    </View>
  );
}

type SessionSummaryProps = {
  summary: SessionSummaryData | null;
  onClose: () => void;
};

export function SessionSummary({ summary, onClose }: SessionSummaryProps) {
  useEffect(() => {
    if (summary) celebrate();
  }, [summary]);

  if (!summary) return null;

  const leveledUp = summary.levelAfter > summary.levelBefore;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View
        className="flex-1 items-center justify-center px-7"
        style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
      >
        <Animated.View
          entering={ZoomIn.springify().damping(16)}
          className="w-full overflow-hidden rounded-3xl"
          style={{
            borderWidth: 1,
            borderColor: `${NEON.green}40`,
            shadowColor: NEON.green,
            shadowOpacity: 0.4,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: 0 },
            elevation: 20,
          }}
        >
          <LinearGradient
            colors={[`${NEON.green}14`, 'rgba(4,6,5,0.99)']}
            className="px-6 pb-6 pt-7"
          >
            <Animated.View entering={FadeInUp.delay(80)}>
              <Text
                className="text-center text-[10px] font-bold uppercase tracking-[4px]"
                style={{ color: NEON.green }}
              >
                Session Complete
              </Text>
              <Text
                allowFontScaling={false}
                className="mt-3 text-center font-black text-dialed-stat"
                style={{ fontSize: 52, lineHeight: 56 }}
              >
                {summary.somaticStillness}%
              </Text>
              <Text className="text-center text-[11px] uppercase tracking-[2px] text-dialed-muted">
                Somatic Stillness · estimated
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(200)}
              className="mt-6 rounded-2xl px-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              <StatRow label="Deep Time" value={`${summary.minutes} min`} />
              <StatRow label="Focus XP" value={`+${summary.xpEarned}`} accent={NEON.cyan} />
              <StatRow
                label="Day Streak"
                value={`${summary.streakDays} ${summary.streakDays === 1 ? 'day' : 'days'}`}
                accent={NEON.amber}
              />
              <StatRow
                label="Level"
                value={leveledUp ? `${summary.levelBefore} → ${summary.levelAfter}` : `${summary.levelAfter}`}
                accent={leveledUp ? NEON.green : undefined}
              />
            </Animated.View>

            {summary.newUnlocks.map((pad) => (
              <Animated.View
                key={pad.name}
                entering={FadeInDown.delay(340)}
                className="mt-3 flex-row items-center rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: `${NEON.violet}16`,
                  borderWidth: 1,
                  borderColor: `${NEON.violet}45`,
                  gap: 10,
                }}
              >
                <Text allowFontScaling={false} style={{ fontSize: 18 }}>
                  ♬
                </Text>
                <View className="flex-1">
                  <Text className="text-[10px] font-bold uppercase tracking-[2px]" style={{ color: NEON.violetSoft }}>
                    Sound Vault Unlocked
                  </Text>
                  <Text className="text-sm font-bold text-dialed-stat">{pad.name}</Text>
                  <Text className="text-[11px] text-dialed-muted">{pad.flavor}</Text>
                </View>
              </Animated.View>
            ))}

            <Animated.View entering={FadeInDown.delay(440)}>
              <Pressable
                onPress={onClose}
                className="mt-6 items-center rounded-2xl py-3.5"
                style={{
                  backgroundColor: `${NEON.green}1F`,
                  borderWidth: 1,
                  borderColor: `${NEON.green}55`,
                }}
              >
                <Text className="text-sm font-bold" style={{ color: NEON.green }}>
                  Continue
                </Text>
              </Pressable>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}
