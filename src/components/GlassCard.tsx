import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

type GlassCardProps = {
  title: string;
  subtitle: string;
  accent: string;
  selected?: boolean;
  onPress?: () => void;
};

export function GlassCard({ title, subtitle, accent, selected, onPress }: GlassCardProps) {
  return (
    <Pressable onPress={onPress} className="mb-3 active:opacity-90">
      <View
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: selected ? accent : 'rgba(255,255,255,0.12)',
          shadowColor: selected ? accent : '#000',
          shadowOpacity: selected ? 0.35 : 0.15,
          shadowRadius: selected ? 16 : 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <BlurView intensity={40} tint="dark" className="overflow-hidden">
          <LinearGradient
            colors={[`${accent}33`, 'rgba(15,15,20,0.85)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-4 py-4"
          >
            <Text className="text-lg font-semibold text-dialed-stat">{title}</Text>
            <Text className="mt-1 text-sm text-dialed-muted">{subtitle}</Text>
          </LinearGradient>
        </BlurView>
      </View>
    </Pressable>
  );
}
