/**
 * TAB 1 · NEUROHACK — eight acute micro-states in a two-column grid.
 *
 * This is the "I feel like this right now, fix it" surface, so it is
 * deliberately the fastest path in the app: one tap from cold launch to audio.
 * No command sheet, no confirmation step, no detail screen — tapping a card
 * starts the protocol and lands the user on NOW PLAYING.
 *
 * That directness is the whole point of the tab. The Library is where you
 * deliberate; NeuroHack is where you don't have the patience to.
 */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { NEURO_HACKS, type NeuroHack } from '../../src/constants/neurohack';
import { SURFACE, alpha } from '../../src/constants/theme';
import { useAudioEngine } from '../../src/hooks/useAudioEngine';
import { Pressable } from 'react-native';
import { useSession } from '../../src/services/sessionStore';

function HackCard({
  hack,
  index,
  live,
  onPress,
}: {
  hack: NeuroHack;
  index: number;
  live: boolean;
  onPress: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 34).springify().damping(18)}
      style={{ width: '48%' }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          borderRadius: 20,
          padding: 15,
          minHeight: 168,
          justifyContent: 'space-between',
          backgroundColor: live ? alpha(hack.accent, 0.12) : SURFACE.glass,
          borderWidth: 1,
          borderColor: live ? alpha(hack.accent, 0.5) : SURFACE.hairline,
          shadowColor: hack.accent,
          shadowOpacity: live ? 0.5 : 0,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 21 }}>{hack.icon}</Text>
            {live && (
              <View
                style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: hack.accent,
                  shadowColor: hack.accent, shadowOpacity: 1, shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
            )}
          </View>

          <Text
            style={{
              color: '#FFFFFF', fontSize: 16, fontWeight: '800',
              letterSpacing: -0.3, marginTop: 9,
            }}
          >
            {hack.label}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.42)', fontSize: 11,
              lineHeight: 16, marginTop: 5,
            }}
            numberOfLines={3}
          >
            {hack.promise}
          </Text>
        </View>

        <View
          style={{
            marginTop: 11,
            alignSelf: 'flex-start',
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 3,
            backgroundColor: alpha(hack.accent, 0.14),
            borderWidth: 1,
            borderColor: alpha(hack.accent, 0.34),
          }}
        >
          <Text
            style={{
              color: hack.accent, fontSize: 9.5, fontWeight: '800',
              letterSpacing: 1, fontFamily: 'Menlo',
            }}
          >
            {hack.hzLabel}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function NeuroHackScreen() {
  const { playProtocolAndNavigate } = useAudioEngine();
  const activeId = useSession((s) => s.protocolId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 18 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 14, marginBottom: 18 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.38)', fontSize: 10.5,
              fontWeight: '700', letterSpacing: 4, textTransform: 'uppercase',
            }}
          >
            Acute Micro-States
          </Text>
          <Text
            style={{
              color: '#FFFFFF', fontSize: 32, fontWeight: '900',
              letterSpacing: -1, marginTop: 2,
            }}
          >
            NeuroHack
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.4)', fontSize: 13,
              lineHeight: 19, marginTop: 7,
            }}
          >
            Name what you're feeling. One tap starts it — no setup.
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row', flexWrap: 'wrap',
            justifyContent: 'space-between', rowGap: 13,
          }}
        >
          {NEURO_HACKS.map((hack, i) => (
            <HackCard
              key={hack.id}
              hack={hack}
              index={i}
              live={activeId === hack.id}
              onPress={() => { void playProtocolAndNavigate(hack.id); }}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
