/**
 * StateCheckIn — the 2-second before/after read.
 *
 * Deliberately one tap. No "next" button, no confirm step: tapping a chip
 * records the level and dismisses. Anything slower gets skipped, and a
 * check-in people skip produces no data and no benefit.
 *
 * Presented as a sheet over the session rather than a separate route so it
 * cannot be back-navigated into a half state, and so the pre-session read
 * happens without the user losing their place in the tab they started from.
 */

import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import {
  CHECK_IN_SCALE,
  type CheckInLevel,
} from '../constants/checkIn';
import { SURFACE, alpha } from '../constants/theme';
import { tapSelect } from '../services/haptics';

export type StateCheckInProps = {
  visible: boolean;
  /** 'pre' asks where they are; 'post' asks where they landed. */
  phase: 'pre' | 'post';
  onSelect: (level: CheckInLevel) => void;
  /** Skipping is always allowed — a forced check-in is a dark pattern. */
  onSkip: () => void;
};

export function StateCheckIn({ visible, phase, onSelect, onSkip }: StateCheckInProps) {
  if (!visible) return null;

  const title = phase === 'pre' ? 'Where are you right now?' : 'Where are you now?';
  const sub =
    phase === 'pre'
      ? 'One tap. This is how you find out whether it worked.'
      : 'Answer honestly — including if nothing moved.';

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.86)',
        justifyContent: 'center',
        paddingHorizontal: 20,
        zIndex: 100,
      }}
    >
      <Animated.View entering={FadeInUp.springify().damping(20)}>
        <Text
          style={{
            color: '#FFFFFF', fontSize: 24, fontWeight: '900',
            letterSpacing: -0.6, textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.42)', fontSize: 13, lineHeight: 19,
            textAlign: 'center', marginTop: 8, marginBottom: 26,
          }}
        >
          {sub}
        </Text>

        <View style={{ gap: 9 }}>
          {CHECK_IN_SCALE.map((opt) => (
            <Pressable
              key={opt.level}
              onPress={() => { tapSelect(); onSelect(opt.level); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center',
                borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15,
                backgroundColor: pressed ? alpha(opt.color, 0.16) : SURFACE.glass,
                borderWidth: 1,
                borderColor: pressed ? alpha(opt.color, 0.55) : SURFACE.hairline,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Text style={{ fontSize: 18, width: 28 }}>{opt.icon}</Text>
              <Text
                style={{
                  color: '#FFFFFF', fontSize: 16, fontWeight: '700',
                  letterSpacing: -0.2, flex: 1,
                }}
              >
                {opt.label}
              </Text>
              {/* Position on the scale, so the axis is legible at a glance */}
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {CHECK_IN_SCALE.map((s) => (
                  <View
                    key={s.level}
                    style={{
                      width: 5, height: 5, borderRadius: 2.5,
                      backgroundColor:
                        s.level <= opt.level ? opt.color : 'rgba(255,255,255,0.12)',
                    }}
                  />
                ))}
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={onSkip} hitSlop={12} style={{ marginTop: 18 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.3)', fontSize: 12.5,
              textAlign: 'center', fontWeight: '600',
            }}
          >
            Skip
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
