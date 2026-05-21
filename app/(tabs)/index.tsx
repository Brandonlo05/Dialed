import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard } from '../../src/components/GlassCard';
import { StatBox } from '../../src/components/StatBox';
import { FOCUS_MODES, STAT_BOXES, type FocusModeId } from '../../src/constants/modes';
import { startAudioSession, stopAudioSession } from '../../src/services/audioEngine';

export default function DashboardScreen() {
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
        brownNoiseEnabled: modeId === 'standard-focus',
      });
      setIsPlaying(true);
    },
    [activeMode, isPlaying],
  );

  const activeModeData = FOCUS_MODES.find((m) => m.id === activeMode);

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-8 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Binaural Focus
          </Text>
          <Text className="mt-0.5 text-[34px] font-black tracking-tight text-dialed-stat">
            Dialed
          </Text>
          <View className="mt-2 flex-row items-center" style={{ gap: 6 }}>
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: isPlaying ? '#4ade80' : 'rgba(255,255,255,0.18)',
              }}
            />
            <Text className="text-xs text-dialed-muted">
              {isPlaying && activeModeData
                ? `${activeModeData.title} · ${activeModeData.beatHz} Hz · Active`
                : 'Select a mode to begin entrainment'}
            </Text>
          </View>
        </View>

        {/* Mode Cards */}
        <Text className="mb-3 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
          Entrainment Modes
        </Text>
        {FOCUS_MODES.map((mode) => (
          <GlassCard
            key={mode.id}
            title={mode.title}
            subtitle={mode.subtitle}
            accent={mode.accent}
            icon={mode.icon}
            selected={activeMode === mode.id}
            onPress={() => toggleMode(mode.id)}
          />
        ))}

        {/* Stats Grid */}
        <Text className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[3px] text-dialed-muted">
          Performance Metrics
        </Text>
        <View className="flex-row flex-wrap" style={{ gap: 10 }}>
          {STAT_BOXES.map((stat) => (
            <View key={stat.label} style={{ width: '47.5%' }}>
              <StatBox
                value={stat.value}
                label={stat.label}
                detail={stat.detail}
                accentColor={stat.accentColor}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
