/**
 * SessionResult — the before → after read, shown once the post check-in lands.
 *
 * This is the screen that makes the product honest. It reports the delta
 * exactly as the user gave it, including "Held steady" and "Went the other
 * way". An app that only ever congratulates itself teaches users to distrust
 * everything else it says — and the negative reads are the most useful signal
 * the product can collect, because they tell you which protocol failed for
 * which person.
 *
 * Deliberately does NOT attribute the change to the frequencies. It reports
 * what the user felt, next to what they ran. That is a claim we can stand
 * behind; "40 Hz moved you from Foggy to Clear" is not.
 */

import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import {
  deltaSummary,
  levelColor,
  levelLabel,
  type CheckInLevel,
} from '../constants/checkIn';
import { SURFACE, alpha } from '../constants/theme';
import { tapSelect } from '../services/haptics';

export type SessionResultProps = {
  before: CheckInLevel;
  after: CheckInLevel;
  title: string;
  minutes: number;
  accent: string;
  onClose: () => void;
};

export function SessionResult({
  before, after, title, minutes, accent, onClose,
}: SessionResultProps) {
  const moved = after - before;
  const tint = moved > 0 ? levelColor(after) : moved < 0 ? '#FF3B30' : '#8b849c';

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center', paddingHorizontal: 22, zIndex: 110,
      }}
    >
      <Animated.View entering={FadeInUp.springify().damping(20)}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.32)', fontSize: 10, fontWeight: '800',
            letterSpacing: 3.5, textTransform: 'uppercase', textAlign: 'center',
          }}
        >
          {Math.max(1, Math.round(minutes))} min · {title}
        </Text>

        {/* before → after */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 14, marginTop: 22,
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.4)', fontSize: 9,
                fontWeight: '800', letterSpacing: 2, marginBottom: 5,
              }}
            >
              BEFORE
            </Text>
            <Text style={{ color: levelColor(before), fontSize: 20, fontWeight: '900' }}>
              {levelLabel(before)}
            </Text>
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.28)', fontSize: 22, marginTop: 14 }}>→</Text>

          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.4)', fontSize: 9,
                fontWeight: '800', letterSpacing: 2, marginBottom: 5,
              }}
            >
              AFTER
            </Text>
            <Text style={{ color: levelColor(after), fontSize: 20, fontWeight: '900' }}>
              {levelLabel(after)}
            </Text>
          </View>
        </View>

        {/* the honest verdict */}
        <Text
          style={{
            color: tint, fontSize: 26, fontWeight: '900', letterSpacing: -0.6,
            textAlign: 'center', marginTop: 24,
          }}
        >
          {deltaSummary(before, after)}
        </Text>

        <Text
          style={{
            color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 20,
            textAlign: 'center', marginTop: 10, paddingHorizontal: 8,
          }}
        >
          {moved > 0
            ? 'Worth noting what you ran — repeat what works for you.'
            : moved === 0
              ? 'Not every session moves the needle. Longer sittings tend to do more.'
              : 'Good to know. Try a slower pattern next time, or a longer session.'}
        </Text>

        <View
          style={{
            marginTop: 22, borderRadius: 14, padding: 13,
            backgroundColor: SURFACE.glass,
            borderWidth: 1, borderColor: SURFACE.hairline,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.34)', fontSize: 11.5, lineHeight: 17 }}>
            Your own read is the measurement that matters. Dialed logs it so you
            can see which protocols actually work for you over time.
          </Text>
        </View>

        <Pressable
          onPress={() => { tapSelect(); onClose(); }}
          style={({ pressed }) => ({
            marginTop: 20, borderRadius: 16, paddingVertical: 15, alignItems: 'center',
            backgroundColor: alpha(accent, 0.15),
            borderWidth: 1, borderColor: alpha(accent, 0.45),
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text
            style={{
              color: accent, fontSize: 12.5, fontWeight: '900',
              letterSpacing: 3, textTransform: 'uppercase',
            }}
          >
            Done
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
