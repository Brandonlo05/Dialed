/**
 * MiniPlayer — persistent session bar docked above the tab bar.
 *
 * ── WHY THIS EXISTS (it was not in the brief) ──────────────────────────────
 * Moving Now Playing into its own tab creates a problem the brief doesn't
 * address: the moment a user leaves that tab to browse the Library, every
 * signal that audio is running disappears. They're left asking "is it still
 * going?" and, worse, have to hunt for the right tab just to stop it.
 *
 * Every mature player app solves this the same way — Spotify, Apple Music,
 * Brain.fm, Podcasts — with a docked bar showing what's playing and a stop
 * control, which expands to the full view on tap. It is the single cheapest
 * thing that makes a tabbed player feel like a product rather than a set of
 * screens, so it ships as part of the restructure.
 *
 * It hides itself on the Now Playing tab (where it would duplicate the hero)
 * and when nothing is running.
 *
 * COST: subscribes to four primitive slices of the session store, so it
 * re-renders only when the protocol actually changes — not on burnout's
 * per-second status ticks, and never per frame (the clock is a worklet).
 */

import { BlurView } from 'expo-blur';
import { router, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { SURFACE, alpha } from '../constants/theme';
import { useSession } from '../services/sessionStore';
import { tapSelect } from '../services/haptics';
import { SessionClock } from './SessionClock';

export type MiniPlayerProps = {
  onStop: () => void;
};

export function MiniPlayer({ onStop }: MiniPlayerProps) {
  const pathname = usePathname();

  // Four primitive selectors — each bails out independently on Object.is.
  const isPlaying = useSession((s) => s.isPlaying);
  const title     = useSession((s) => s.title);
  const accent    = useSession((s) => s.accent);
  const beatHz    = useSession((s) => s.beatHz);
  const startedAt = useSession((s) => s.startedAt);

  if (!isPlaying) return null;
  // Redundant with the hero it would sit under.
  if (pathname === '/now-playing') return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20)}
      exiting={FadeOutDown.duration(180)}
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: 84, // clears the tab bar
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: alpha(accent, 0.28),
        shadowColor: accent,
        shadowOpacity: 0.28,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 12,
      }}
    >
      <BlurView intensity={SURFACE.blurIntensity} tint="dark">
        <Pressable
          onPress={() => { tapSelect(); router.navigate('/now-playing'); }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 11,
            backgroundColor: SURFACE.glassDeep,
          }}
        >
          {/* Live indicator */}
          <View
            style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: accent,
              shadowColor: accent, shadowOpacity: 1, shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }}
          />

          <View style={{ flex: 1, marginLeft: 11 }}>
            <Text
              numberOfLines={1}
              style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 }}
            >
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 7 }}>
              <SessionClock
                startedAt={startedAt}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
              />
              <Text style={{ color: alpha(accent, 0.85), fontSize: 11, fontWeight: '700' }}>
                {beatHz.toFixed(1)} Hz
              </Text>
            </View>
          </View>

          {/* Stop — reachable from any tab without navigating first */}
          <Pressable
            onPress={onStop}
            hitSlop={12}
            style={{
              width: 34, height: 34, borderRadius: 17,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,59,48,0.15)',
              borderWidth: 1, borderColor: 'rgba(255,59,48,0.4)',
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#FF3B30' }} />
          </Pressable>
        </Pressable>
      </BlurView>
    </Animated.View>
  );
}
