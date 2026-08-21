/**
 * TAB 3 · NOW PLAYING — breath-first session view.
 *
 * ── WHY THE PACER IS THE HERO ──────────────────────────────────────────────
 * This screen used to lead with frequency: a telemetry pill on top, Hz chips
 * under it, and the breath ring third. That ordering told the user the numbers
 * were the product. They aren't. Paced breathing is the element here with real
 * evidence behind it — slow, exhale-weighted breathing reliably shifts
 * autonomic balance — while binaural/isochronic entrainment has small and
 * inconsistent support. The audio is the environment, the timer and the
 * entrainment anchor; the breath is the mechanism.
 *
 * So the ring now owns the screen, and the frequencies sit beneath it as
 * technical telemetry — visible for the users who care, subordinate for the
 * ones who just need to follow the ring. The visual hierarchy now matches
 * where the effect actually comes from, which is also the only version of this
 * screen we can defend to a regulator.
 *
 * ── CHECK-IN ───────────────────────────────────────────────────────────────
 * The pre-session read is presented AFTER audio has started, not before it.
 * NeuroHack's whole promise is one tap from "I feel bad" to sound; putting a
 * question in front of that would spend the app's best moment on a form. The
 * audio is already fading in while the user answers.
 *
 * ── RENDER COST ────────────────────────────────────────────────────────────
 * Ring, countdown and stopwatch all resolve in Reanimated worklets. This screen
 * re-renders on protocol identity change, on the check-in, and once a second
 * during Burnout (the one preset that publishes a phase countdown).
 */

import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BreathPacer } from '../../src/components/neuro-visualizers/BreathPacer';
import { SessionClock } from '../../src/components/SessionClock';
import { StateCheckIn } from '../../src/components/StateCheckIn';
import { VolumeSlider } from '../../src/components/controls/VolumeSlider';
import type { CheckInLevel } from '../../src/constants/checkIn';
import { BAND_LABEL, SURFACE, alpha, bandFor } from '../../src/constants/theme';
import { useAudioEngine } from '../../src/hooks/useAudioEngine';
import { tapSelect } from '../../src/services/haptics';
import { updateSession, useSessionState } from '../../src/services/sessionStore';
import { getTailoredCardConfig } from '../../src/services/tailoredCopy';
import { getCachedProfile } from '../../src/services/userProfile';

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

  const {
    accent, beatHz, carrierHz, title, subtitle,
    breath, statusLine, startedAt, preAsked,
  } = session;
  const band = bandFor(beatHz);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity strip: small, out of the way ── */}
        <Animated.View
          entering={FadeInDown.duration(240)}
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 20, marginTop: 12,
          }}
        >
          <View
            style={{
              width: 6, height: 6, borderRadius: 3, backgroundColor: accent,
              shadowColor: accent, shadowOpacity: 1, shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          <Text
            style={{
              color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '700',
              letterSpacing: 1.6, textTransform: 'uppercase', marginLeft: 8, flex: 1,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <SessionClock
            startedAt={startedAt}
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}
          />
        </Animated.View>

        {/* ── HERO: the breath pacer owns the screen ── */}
        <View style={{ marginTop: 18 }}>
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

        {/* ── Breath identity: what you are actually doing ── */}
        {breath && (
          <View style={{ alignItems: 'center', marginTop: 16, paddingHorizontal: 24 }}>
            <Text
              style={{
                color: alpha(accent, 0.95), fontSize: 12, fontWeight: '800',
                letterSpacing: 2.4, textTransform: 'uppercase',
              }}
            >
              {breath.name}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.38)', fontSize: 12, lineHeight: 18,
                textAlign: 'center', marginTop: 6,
              }}
            >
              {(60 / Math.max(0.001, breath.cycle[0] + breath.cycle[1] + breath.cycle[2] + breath.cycle[3])).toFixed(1)} breaths/min · follow the ring
            </Text>
          </View>
        )}

        {/* ── Entrainment telemetry: subordinate, technical, honest ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View
            style={{
              borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
              backgroundColor: SURFACE.glass,
              borderWidth: 1, borderColor: SURFACE.hairline,
            }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.28)', fontSize: 8.5, fontWeight: '800',
                letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 6,
              }}
            >
              Entrainment Telemetry
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)', fontSize: 11.5,
                fontFamily: 'Menlo', lineHeight: 17,
              }}
            >
              {beatHz.toFixed(1)} Hz {BAND_LABEL[band]} · {Math.round(carrierHz)} Hz carrier
            </Text>
            {statusLine ? (
              <Text
                style={{
                  color: alpha(accent, 0.75), fontSize: 11,
                  fontFamily: 'Menlo', marginTop: 4,
                }}
              >
                {statusLine}
              </Text>
            ) : (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 16, marginTop: 4,
                }}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* ── Universal calibrated gain ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <SectionLabel>Calibrated Entrainment Gain</SectionLabel>
          <VolumeSlider />
        </View>

        {/* ── Transport ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
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

      {/* Pre-session read — over the top, audio already running underneath */}
      <StateCheckIn
        visible={!preAsked}
        phase="pre"
        onSelect={(level: CheckInLevel) => updateSession({ preState: level, preAsked: true })}
        onSkip={() => updateSession({ preAsked: true })}
      />
    </SafeAreaView>
  );
}
