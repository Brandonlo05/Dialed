/**
 * TAB 3 · NOW PLAYING — the destination of every selection in the app.
 *
 * ── THE IDLE STATE (not in the brief, but required) ────────────────────────
 * A centre tab that renders nothing when idle is a dead tab: the user taps it
 * once, finds a blank screen, and learns to avoid the most valuable slot in the
 * bar. So the idle view is a real screen — it surfaces the user's tailored
 * recommendation with a single ENGAGE control. Tapping the centre tab with
 * nothing playing therefore answers "what should I run right now?", which is
 * the question that brought them back to the app.
 *
 * ── VOLUME LIVES HERE ──────────────────────────────────────────────────────
 * The calibrated-gain slider is embedded directly in the active view rather
 * than hidden behind a settings screen, because the 60–70% phase-locking target
 * only means anything while audio is actually playing and the user can hear
 * what they're adjusting.
 *
 * ── RENDER COST ────────────────────────────────────────────────────────────
 * The breath ring, its countdown and the session stopwatch all run in
 * Reanimated worklets. This screen re-renders only when the protocol identity
 * changes — or once a second during Burnout, which is the one preset that
 * publishes a phase countdown into its status line.
 */

import { ScrollView, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BreathPacer } from '../../src/components/neuro-visualizers/BreathPacer';
import { SessionClock } from '../../src/components/SessionClock';
import { VolumeSlider } from '../../src/components/controls/VolumeSlider';
import { BAND_LABEL, SURFACE, alpha, bandFor } from '../../src/constants/theme';
import { useAudioEngine } from '../../src/hooks/useAudioEngine';
import { tapSelect } from '../../src/services/haptics';
import { useSessionState } from '../../src/services/sessionStore';
import { getTailoredCardConfig } from '../../src/services/tailoredCopy';
import { getCachedProfile } from '../../src/services/userProfile';

/** Small tracked-out caption used above every block on this screen. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: 'rgba(255,255,255,0.32)', fontSize: 9.5, fontWeight: '800',
        letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9,
      }}
    >
      {children}
    </Text>
  );
}

// ── Idle ─────────────────────────────────────────────────────────────────────

function IdleView() {
  const { playTailored } = useAudioEngine();
  const tailored = getTailoredCardConfig(getCachedProfile());
  const accent = tailored.accent;

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center' }}
    >
      <View style={{ alignItems: 'center', marginBottom: 34 }}>
        {/* Dormant ring — same silhouette the live visualizer will occupy, so
            the transition into a session feels like the screen waking up. */}
        <View
          style={{
            width: 148, height: 148, borderRadius: 74,
            borderWidth: 1.5, borderColor: alpha(accent, 0.28),
            alignItems: 'center', justifyContent: 'center',
            shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 30,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <Text style={{ color: alpha(accent, 0.9), fontSize: 34 }}>◎</Text>
        </View>
      </View>

      <Text
        style={{
          color: 'rgba(255,255,255,0.34)', fontSize: 10, fontWeight: '800',
          letterSpacing: 3.5, textAlign: 'center', textTransform: 'uppercase',
        }}
      >
        Recommended for you
      </Text>
      <Text
        style={{
          color: '#FFFFFF', fontSize: 27, fontWeight: '900',
          letterSpacing: -0.7, textAlign: 'center', marginTop: 8,
        }}
      >
        {tailored.title}
      </Text>
      <Text
        style={{
          color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 21,
          textAlign: 'center', marginTop: 9, paddingHorizontal: 12,
        }}
      >
        {tailored.subtitle}
      </Text>

      <Pressable
        onPress={() => { tapSelect(); void playTailored(); }}
        style={({ pressed }) => ({
          marginTop: 30, borderRadius: 18, paddingVertical: 17,
          alignItems: 'center',
          backgroundColor: alpha(accent, 0.15),
          borderWidth: 1, borderColor: alpha(accent, 0.5),
          shadowColor: accent, shadowOpacity: 0.5, shadowRadius: 22,
          shadowOffset: { width: 0, height: 0 },
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Text
          style={{
            color: accent, fontSize: 13, fontWeight: '900',
            letterSpacing: 3.5, textTransform: 'uppercase',
          }}
        >
          Engage Protocol
        </Text>
      </Pressable>

      <Text
        style={{
          color: 'rgba(255,255,255,0.26)', fontSize: 11.5,
          textAlign: 'center', marginTop: 15,
        }}
      >
        Or pick a state from NeuroHack.
      </Text>
    </Animated.View>
  );
}

// ── Active ───────────────────────────────────────────────────────────────────

export default function NowPlayingScreen() {
  const session = useSessionState();
  const { stop } = useAudioEngine();

  if (!session.isPlaying) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
        <IdleView />
      </SafeAreaView>
    );
  }

  const { accent, beatHz, carrierHz, title, subtitle, breath, statusLine, startedAt } = session;
  const band = bandFor(beatHz);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Telemetry pill: identity + clock + band ── */}
        <Animated.View
          entering={FadeInDown.duration(260)}
          style={{
            marginHorizontal: 16, marginTop: 10, borderRadius: 16,
            paddingHorizontal: 15, paddingVertical: 12,
            backgroundColor: SURFACE.glass,
            borderWidth: 1, borderColor: SURFACE.hairline,
            flexDirection: 'row', alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View
                style={{
                  width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent,
                  shadowColor: accent, shadowOpacity: 1, shadowRadius: 7,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
              <Text
                style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 }}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
            <Text
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, marginTop: 3 }}
              numberOfLines={1}
            >
              {statusLine ?? subtitle}
            </Text>
          </View>

          <SessionClock
            startedAt={startedAt}
            style={{ fontSize: 19, fontWeight: '700', letterSpacing: -0.5 }}
          />
        </Animated.View>

        {/* ── Frequency telemetry ── */}
        <View
          style={{
            flexDirection: 'row', justifyContent: 'center',
            gap: 9, marginTop: 13, paddingHorizontal: 16,
          }}
        >
          {[
            { k: 'BEAT',    v: `${beatHz.toFixed(1)} Hz` },
            { k: 'CARRIER', v: `${Math.round(carrierHz)} Hz` },
            { k: 'BAND',    v: BAND_LABEL[band] },
          ].map((chip) => (
            <View
              key={chip.k}
              style={{
                borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5,
                backgroundColor: alpha(accent, 0.1),
                borderWidth: 1, borderColor: alpha(accent, 0.26),
              }}
            >
              <Text
                style={{
                  color: alpha(accent, 0.95), fontSize: 10, fontWeight: '800',
                  fontFamily: 'Menlo', letterSpacing: 0.6,
                }}
              >
                {chip.k} {chip.v}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Full-bleed breath visualizer ── */}
        <View style={{ marginTop: 22 }}>
          {breath ? (
            <BreathPacer cycle={breath.cycle} color={accent} carrierHz={carrierHz} />
          ) : (
            <View style={{ height: 300, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                Audio running — no breath pattern paired
              </Text>
            </View>
          )}
        </View>

        {/* ── Universal calibrated gain ── */}
        <View style={{ paddingHorizontal: 18, marginTop: 26 }}>
          <SectionLabel>Calibrated Entrainment Gain</SectionLabel>
          <VolumeSlider />
        </View>

        {/* ── Transport ── */}
        <View style={{ paddingHorizontal: 18, marginTop: 22 }}>
          <Pressable
            onPress={() => { void stop(); }}
            style={({ pressed }) => ({
              borderRadius: 18, paddingVertical: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 10,
              backgroundColor: 'rgba(255,59,48,0.15)',
              borderWidth: 1, borderColor: 'rgba(255,59,48,0.42)',
              shadowColor: '#FF3B30', shadowOpacity: 0.3, shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View
              style={{
                width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30',
                shadowColor: '#FF3B30', shadowOpacity: 1, shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
            <Text
              style={{
                color: '#FF3B30', fontSize: 12.5, fontWeight: '900',
                letterSpacing: 3.5, textTransform: 'uppercase',
              }}
            >
              End Session
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
