import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function SettingRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl"
      style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.025)']}
        className="px-4 py-4"
      >
        <View className="flex-row items-center">
          <View className="flex-1 pr-4">
            <Text className="font-semibold text-dialed-stat">{title}</Text>
            <Text className="mt-0.5 text-xs leading-[18px] text-dialed-muted">{description}</Text>
          </View>
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#7c5cff' }}
            thumbColor={value ? '#e8e6f3' : '#4a4558'}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

export default function SettingsScreen() {
  const [brownNoise, setBrownNoise] = useState(true);
  const [parallelAudio, setParallelAudio] = useState(true);
  const [harmonicMatch, setHarmonicMatch] = useState(true);
  const [watchSync, setWatchSync] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Configuration
          </Text>
          <Text className="mt-0.5 text-[28px] font-black tracking-tight text-dialed-stat">
            Settings
          </Text>
        </View>

        <Text className="mb-2 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Audio Engine
        </Text>
        <SettingRow
          title="ADHD Brownian Noise"
          description="Broadband noise layer underneath binaural tones for attention anchoring"
          value={brownNoise}
          onChange={setBrownNoise}
        />
        <SettingRow
          title="Parallel Audio"
          description="Mixes entrainment with Spotify without ducking or interruption"
          value={parallelAudio}
          onChange={setParallelAudio}
        />

        <Text className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Intelligence
        </Text>
        <SettingRow
          title="Spotify Harmonic Match"
          description="Recalibrate carrier tones to current song key within 3 seconds"
          value={harmonicMatch}
          onChange={setHarmonicMatch}
        />
        <SettingRow
          title="Apple Watch Sync"
          description="Adaptive mode switching based on HRV and biometric data (Phase 3)"
          value={watchSync}
          onChange={setWatchSync}
        />

        <View
          className="mt-6 overflow-hidden rounded-2xl"
          style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.015)']}
            className="p-4"
          >
            <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
              Build Note
            </Text>
            <Text className="text-xs leading-[18px] text-dialed-muted">
              Native audio requires a development build.{'\n'}Run{' '}
              <Text className="font-mono text-dialed-stat">expo prebuild</Text> then{' '}
              <Text className="font-mono text-dialed-stat">expo run:ios</Text>.
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
