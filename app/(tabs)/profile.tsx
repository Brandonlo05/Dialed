import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      <LinearGradient colors={[`${accent}14`, 'rgba(10,10,16,0.97)']} className="p-4">
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

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Biometrics
          </Text>
          <Text className="mt-0.5 text-[28px] font-black tracking-tight text-dialed-stat">
            Profile
          </Text>
        </View>

        {/* Avatar */}
        <View className="mb-6 items-center">
          <View
            className="h-20 w-20 items-center justify-center rounded-full"
            style={{
              borderWidth: 1.5,
              borderColor: 'rgba(124,92,255,0.45)',
              backgroundColor: 'rgba(124,92,255,0.1)',
            }}
          >
            <Text allowFontScaling={false} style={{ fontSize: 30 }}>
              ◉
            </Text>
          </View>
          <Text className="mt-3 text-base font-bold text-dialed-stat">Entrainment Profile</Text>
          <Text className="mt-0.5 text-xs text-dialed-muted">
            Biometric sync available in Phase 3
          </Text>
        </View>

        {/* Session metrics */}
        <Text className="mb-1 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Session History
        </Text>
        <View className="flex-row" style={{ margin: -4, marginBottom: 0 }}>
          <MetricCard label="Sessions" value="—" sub="Begin tracking" accent="#7c5cff" />
          <MetricCard label="Total Time" value="—" sub="Cumulative" accent="#5eead4" />
        </View>
        <View className="flex-row" style={{ margin: -4 }}>
          <MetricCard label="Fav Mode" value="—" sub="Most used" accent="#fb923c" />
          <MetricCard label="Streak" value="—" sub="Days active" accent="#f472b6" />
        </View>

        {/* Apple Watch card */}
        <View
          className="mt-5 overflow-hidden rounded-2xl"
          style={{ borderWidth: 1, borderColor: 'rgba(94,234,212,0.15)' }}
        >
          <LinearGradient
            colors={['rgba(94,234,212,0.08)', 'rgba(10,10,16,0.97)']}
            className="p-5"
          >
            <View className="flex-row items-center" style={{ gap: 12 }}>
              <Text allowFontScaling={false} style={{ fontSize: 28 }}>
                ⌚
              </Text>
              <View className="flex-1">
                <Text className="font-bold text-dialed-stat">Apple Watch</Text>
                <Text className="mt-0.5 text-xs leading-[18px] text-dialed-muted">
                  HRV-adaptive mode switching · Phase 3
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
