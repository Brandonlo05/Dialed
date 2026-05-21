import { Text, View } from 'react-native';

type StatBoxProps = {
  value: string;
  label: string;
  detail: string;
};

export function StatBox({ value, label, detail }: StatBoxProps) {
  return (
    <View className="min-h-[88px] flex-1 rounded-xl border border-dialed-border bg-dialed-card p-3">
      <Text className="text-2xl font-bold tracking-tight text-dialed-stat">{value}</Text>
      <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-dialed-accent">
        {label}
      </Text>
      <Text className="mt-1 text-[10px] leading-tight text-dialed-muted">{detail}</Text>
    </View>
  );
}
