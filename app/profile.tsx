import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-dialed-bg px-5" edges={['bottom']}>
      <View className="mt-4 rounded-xl border border-dialed-border bg-dialed-card p-5">
        <Text className="text-lg font-semibold text-dialed-stat">Entrainment profile</Text>
        <Text className="mt-2 text-sm leading-5 text-dialed-muted">
          Biometric telemetry from Apple Watch will appear here once the watchOS companion pipe is
          paired (Phase 3).
        </Text>
      </View>
    </SafeAreaView>
  );
}
