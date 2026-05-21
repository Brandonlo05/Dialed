import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../src/components/GlassCard';
import { StatBox } from '../../src/components/StatBox';
import { FOCUS_MODES, STAT_BOXES, type FocusModeId } from '../../src/constants/modes';
import { startAudioSession, stopAudioSession } from '../../src/services/audioEngine';

export default function DashboardScreen() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<FocusModeId | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleMode = useCallback(
    async (modeId: FocusModeId) => {
      const mode = FOCUS_MODES.find((m) => m.id === modeId);
      if (!mode) return;

      if (activeMode === modeId && isPlaying) {
        await stopAudioSession();
        setIsPlaying(false);
        setActiveMode(null);
        return;
      }

      setActiveMode(modeId);
      await startAudioSession({
        carrierHz: mode.carrierHz,
        beatHz: mode.beatHz,
        brownNoiseEnabled: modeId === 'calm-reset',
      });
      setIsPlaying(true);
    },
    [activeMode, isPlaying],
  );

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 mt-2 flex-row items-end justify-between">
          <View>
            <Text className="text-xs font-medium uppercase tracking-[3px] text-dialed-muted">
              Dialed
            </Text>
            <Text className="mt-1 text-3xl font-bold text-dialed-stat">Focus Dashboard</Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push('/settings')}
              className="rounded-full border border-dialed-border px-3 py-2"
            >
              <Text className="text-xs text-dialed-muted">Settings</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/profile')}
              className="rounded-full border border-dialed-border px-3 py-2"
            >
              <Text className="text-xs text-dialed-muted">Profile</Text>
            </Pressable>
          </View>
        </View>

        <Text className="mb-3 text-sm font-medium text-dialed-muted">Entrainment modes</Text>
        {FOCUS_MODES.map((mode) => (
          <GlassCard
            key={mode.id}
            title={mode.title}
            subtitle={mode.subtitle}
            accent={mode.accent}
            selected={activeMode === mode.id}
            onPress={() => toggleMode(mode.id)}
          />
        ))}

        <Text className="mb-3 mt-6 text-sm font-medium text-dialed-muted">Performance metrics</Text>
        <View className="flex-row flex-wrap gap-2">
          {STAT_BOXES.map((stat) => (
            <View key={stat.label} className="w-[48%]">
              <StatBox value={stat.value} label={stat.label} detail={stat.detail} />
            </View>
          ))}
        </View>

        {isPlaying && activeMode ? (
          <View className="mt-6 rounded-xl border border-dialed-accent/40 bg-dialed-accent/10 p-4">
            <Text className="text-sm font-semibold text-dialed-stat">
              Session active · {FOCUS_MODES.find((m) => m.id === activeMode)?.title}
            </Text>
            <Text className="mt-1 text-xs text-dialed-muted">
              Parallel playback enabled — mixes with Spotify without ducking.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
