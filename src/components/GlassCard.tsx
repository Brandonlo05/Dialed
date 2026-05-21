import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type GlassCardProps = {
  title: string;
  subtitle: string;
  accent: string;
  icon: string;
  selected?: boolean;
  onPress?: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassCard({ title, subtitle, accent, icon, selected, onPress }: GlassCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 350 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 350 });
      }}
      style={animatedStyle}
      className="mb-3"
    >
      <View
        className="overflow-hidden rounded-2xl"
        style={{
          borderWidth: 1,
          borderColor: selected ? accent : 'rgba(255,255,255,0.09)',
          shadowColor: selected ? accent : '#000',
          shadowOpacity: selected ? 0.55 : 0.2,
          shadowRadius: selected ? 24 : 8,
          shadowOffset: { width: 0, height: selected ? 6 : 3 },
          elevation: selected ? 14 : 4,
        }}
      >
        <BlurView intensity={50} tint="dark" className="overflow-hidden">
          <LinearGradient
            colors={
              selected
                ? [`${accent}3D`, `${accent}14`, 'rgba(8,8,14,0.96)']
                : [`${accent}18`, 'rgba(12,12,18,0.92)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-5 py-4"
          >
            <View className="flex-row items-center">
              <View className="flex-1 pr-4">
                <View className="mb-1 flex-row items-center" style={{ gap: 7 }}>
                  {selected && (
                    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                  )}
                  <Text className="text-[17px] font-bold tracking-tight text-dialed-stat">
                    {title}
                  </Text>
                </View>
                <Text className="text-xs leading-[18px] text-dialed-muted">{subtitle}</Text>
              </View>
              <View
                className="h-11 w-11 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: selected ? `${accent}2E` : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: selected ? `${accent}55` : 'rgba(255,255,255,0.09)',
                }}
              >
                <Text allowFontScaling={false} style={{ fontSize: 20 }}>
                  {icon}
                </Text>
              </View>
            </View>
            {selected && (
              <View className="mt-3 flex-row items-center" style={{ gap: 8 }}>
                <View
                  className="h-px flex-1 rounded-full"
                  style={{ backgroundColor: `${accent}35` }}
                />
                <Text
                  className="text-[10px] font-bold uppercase tracking-[2.5px]"
                  style={{ color: accent }}
                >
                  Active
                </Text>
                <View
                  className="h-px flex-1 rounded-full"
                  style={{ backgroundColor: `${accent}35` }}
                />
              </View>
            )}
          </LinearGradient>
        </BlurView>
      </View>
    </AnimatedPressable>
  );
}
