import { ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

export default function SettingsScreen() {
  const [brownNoiseDefault, setBrownNoiseDefault] = useState(true);
  const [harmonicMatch, setHarmonicMatch] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['bottom']}>
      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8">
        <Text className="mb-4 text-sm text-dialed-muted">
          Configure entrainment defaults. Native audio requires a development build.
        </Text>

        <View className="mb-3 rounded-xl border border-dialed-border bg-dialed-card p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-semibold text-dialed-stat">ADHD Brownian noise</Text>
              <Text className="mt-1 text-xs text-dialed-muted">Default on for Calm Reset mode</Text>
            </View>
            <Switch
              value={brownNoiseDefault}
              onValueChange={setBrownNoiseDefault}
              trackColor={{ false: '#333', true: '#7c5cff' }}
            />
          </View>
        </View>

        <View className="mb-3 rounded-xl border border-dialed-border bg-dialed-card p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="font-semibold text-dialed-stat">Spotify harmonic match</Text>
              <Text className="mt-1 text-xs text-dialed-muted">
                Recalibrate carrier tones to song key within 3s
              </Text>
            </View>
            <Switch
              value={harmonicMatch}
              onValueChange={setHarmonicMatch}
              trackColor={{ false: '#333', true: '#7c5cff' }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
