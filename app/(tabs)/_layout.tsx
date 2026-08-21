/**
 * Five-tab shell.
 *
 *   NEUROHACK · LIBRARY · [ NOW PLAYING ] · TUNER · PROFILE
 *
 * NOW PLAYING sits dead centre because it is the destination of every
 * selection in the app — the routing engine sends the user here from any tab.
 * Centring it also puts the most-returned-to screen under the thumb.
 *
 * Three routes stay in the router but out of the bar (`href: null`):
 *   index    — redirects `/` to the NeuroHack grid so deep links still resolve
 *   gym      — Training Mode's tri-phasic cockpit, launched from the Library
 *   settings — Neuro-Labs and recalibration, launched from Profile
 *
 * The mini-player and the session-summary modal are mounted HERE rather than
 * inside a screen, because both must survive tab switches: stopping a session
 * from the Library should still award XP and show the summary.
 */

import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MiniPlayer } from '../../src/components/MiniPlayer';
import { SessionResult } from '../../src/components/SessionResult';
import { StateCheckIn } from '../../src/components/StateCheckIn';
import { SessionSummary } from '../../src/components/SessionSummary';
import { SURFACE, alpha } from '../../src/constants/theme';
import { useAudioEngine } from '../../src/hooks/useAudioEngine';
import type { SessionSummaryData } from '../../src/services/gamification';
import type { CheckInLevel } from '../../src/constants/checkIn';
import {
  publishSummary,
  requestPostCheckIn,
  useSession,
  usePendingPostCheckIn,
  usePendingSummary,
} from '../../src/services/sessionStore';
import { loadUserProfile } from '../../src/services/userProfile';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const INACTIVE = '#4a4458';

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/**
 * Centre tab gets a ring so it reads as the app's home base, and the ring
 * lights in the live protocol's accent while audio is running — the tab bar
 * itself becomes a playback indicator.
 */
function NowPlayingIcon({ color, focused }: { color: string; focused: boolean }) {
  const isPlaying = useSession((s) => s.isPlaying);
  const accent = useSession((s) => s.accent);
  const tint = isPlaying ? accent : color;

  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -2,
        backgroundColor: isPlaying || focused ? alpha(tint, 0.14) : 'transparent',
        borderWidth: 1.5,
        borderColor: isPlaying || focused ? alpha(tint, 0.55) : 'rgba(255,255,255,0.10)',
        shadowColor: tint,
        shadowOpacity: isPlaying ? 0.9 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Ionicons name={isPlaying ? 'pulse' : 'play'} size={20} color={tint} />
    </View>
  );
}

export default function TabsLayout() {
  const [status, setStatus] = useState<'loading' | 'calibrated' | 'new'>('loading');

  // Read from the store rather than a local callback, so a session ended from
  // the Now Playing transport shows the same summary as one ended here.
  const summary = usePendingSummary<SessionSummaryData>();
  const { stop } = useAudioEngine();

  // Post-session read, then the before/after result. Mounted here (not in a
  // screen) so it fires regardless of which surface ended the session.
  const postReq = usePendingPostCheckIn();
  const [afterLevel, setAfterLevel] = useState<CheckInLevel | null>(null);

  useEffect(() => {
    loadUserProfile().then((profile) => setStatus(profile ? 'calibrated' : 'new'));
  }, []);

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
  }
  if (status === 'new') {
    return <Redirect href="/onboarding" />;
  }

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: INACTIVE,
          // Transparent so the blur layer beneath shows through.
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: SURFACE.hairline,
            height: 84,
            paddingBottom: 26,
            paddingTop: 9,
            elevation: 0,
          },
          tabBarBackground: () => (
            <BlurView
              intensity={SURFACE.blurIntensity}
              tint="dark"
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,18,22,0.85)' }]}
            />
          ),
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 0.8,
            marginTop: 3,
          },
        }}
        tabBar={(props) => (
          <View>
            <MiniPlayer onStop={() => { void stop(); }} />
            <BottomTabBar {...props} />
          </View>
        )}
      >
        <Tabs.Screen
          name="neurohack"
          options={{
            title: 'NEUROHACK',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="flash-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'LIBRARY',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="albums-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="now-playing"
          options={{
            title: 'NOW PLAYING',
            tabBarIcon: ({ color, focused }) => (
              <NowPlayingIcon color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="tuner"
          options={{
            title: 'TUNER',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="options-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'PROFILE',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="person-outline" color={color} size={size} />
            ),
          }}
        />

        {/* ── Routable, but not in the bar ── */}
        <Tabs.Screen name="index"    options={{ href: null }} />
        <Tabs.Screen name="gym"      options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>

      <SessionSummary summary={summary} onClose={() => publishSummary(null)} />

      {/* Ask where they landed... */}
      <StateCheckIn
        visible={postReq != null && afterLevel == null}
        phase="post"
        onSelect={setAfterLevel}
        onSkip={() => requestPostCheckIn(null)}
      />

      {/* ...then show the delta, exactly as they reported it. */}
      {postReq != null && afterLevel != null && (
        <SessionResult
          before={postReq.preState}
          after={afterLevel}
          title={postReq.title}
          minutes={postReq.minutes}
          accent={postReq.accent}
          onClose={() => { setAfterLevel(null); requestPostCheckIn(null); }}
        />
      )}
    </>
  );
}
