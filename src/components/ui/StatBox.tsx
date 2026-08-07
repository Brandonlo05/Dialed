import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

type StatBoxProps = {
  value: string;
  label: string;
  detail: string;
  accentColor?: string;
};

export function StatBox({ value, label, detail, accentColor = '#7c5cff' }: StatBoxProps) {
  return (
    <View
      className="overflow-hidden rounded-2xl"
      style={{
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.09)',
        shadowColor: accentColor,
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <LinearGradient
        colors={[`${accentColor}12`, 'rgba(10,10,16,0.97)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="min-h-[100px] p-4"
      >
        <Text
          allowFontScaling={false}
          className="text-[30px] font-black leading-none tracking-tight"
          style={{ color: accentColor }}
        >
          {value}
        </Text>
        <Text className="mt-1.5 text-[10px] font-bold uppercase tracking-[2px] text-dialed-stat">
          {label}
        </Text>
        <Text className="mt-1 text-[10px] leading-[14px] text-dialed-muted">{detail}</Text>
        <View
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ backgroundColor: `${accentColor}30` }}
        />
      </LinearGradient>
    </View>
  );
}
