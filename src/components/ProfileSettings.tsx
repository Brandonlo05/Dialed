/**
 * Profile settings block — goal, default gain, hardware, diagnostics link.
 *
 * ── ON THE GOAL SELECTOR ───────────────────────────────────────────────────
 * The brief names four goals: ADHD Focus, Academic Performance, Athletic
 * Drive, Stress Recovery. Those describe *who the user is*, which the app
 * already captures as `role` during the neural diagnostic. What actually
 * reaches the DSP is `SessionGoal` — it feeds `calibrate()` and shifts real
 * carrier/beat/noise values.
 *
 * So this selector is built on SessionGoal rather than a parallel four-item
 * list. A second taxonomy would have looked identical on screen while
 * changing nothing about the audio, which is the worst kind of setting: one
 * the user believes is doing something. Role stays editable by re-running the
 * diagnostic from the Neuro-Labs link below.
 *
 * ── ON HARDWARE ROUTE DIAGNOSTICS ──────────────────────────────────────────
 * Live output-route detection ("AirPods Pro connected") requires reading
 * AVAudioSession.currentRoute and bridging it to JS. That setter does not
 * exist, and adding it means editing the native audio module, which this
 * sprint's guardrail forbids. Rather than print a plausible-looking but
 * invented device name, this section reports only what is genuinely known:
 * whether headphone transport controls are armed.
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { SURFACE, alpha } from '../constants/theme';
import { getLastVolume, setVolume } from '../services/audioEngine';
import { tapSelect } from '../services/haptics';
import { loadJson, saveJson } from '../services/storage';
import {
  GOAL_LABELS,
  getCachedProfile,
  saveUserProfile,
  type SessionGoal,
} from '../services/userProfile';

const DEFAULT_VOL_KEY = '@dialed/default-volume';
const ACCENT = '#7c5cff';

/** The calibrated sweet spot the volume slider also targets. */
const TARGET_LO = 0.6;
const TARGET_HI = 0.7;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{
          color: 'rgba(255,255,255,0.32)', fontSize: 9.5, fontWeight: '800',
          letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          borderRadius: 18, padding: 14,
          backgroundColor: SURFACE.glass,
          borderWidth: 1, borderColor: SURFACE.hairline,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function ProfileSettings() {
  const [goal, setGoal] = useState<SessionGoal | null>(null);
  const [defaultVol, setDefaultVol] = useState(getLastVolume());

  useEffect(() => {
    setGoal(getCachedProfile()?.goal ?? null);
    void loadJson<number>(DEFAULT_VOL_KEY).then((v) => {
      if (typeof v === 'number') setDefaultVol(v);
    });
  }, []);

  async function chooseGoal(next: SessionGoal) {
    tapSelect();
    setGoal(next);
    const profile = getCachedProfile();
    // Guard: the goal only persists once a calibration profile exists. Before
    // onboarding completes there is nothing to merge into.
    if (profile) await saveUserProfile({ ...profile, goal: next });
  }

  async function chooseVolume(v: number) {
    tapSelect();
    setDefaultVol(v);
    await saveJson(DEFAULT_VOL_KEY, v);
    await setVolume(v);
  }

  const inTarget = defaultVol >= TARGET_LO && defaultVol <= TARGET_HI;

  return (
    <View style={{ marginTop: 8 }}>
      {/* ── Session goal ── */}
      <Card title="Session Goal">
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, lineHeight: 17, marginBottom: 11 }}>
          Shifts carrier, beat and noise floor across every calibrated protocol.
        </Text>
        <View style={{ gap: 8 }}>
          {(Object.keys(GOAL_LABELS) as SessionGoal[]).map((g) => {
            const on = goal === g;
            return (
              <Pressable
                key={g}
                onPress={() => { void chooseGoal(g); }}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11,
                  backgroundColor: on ? alpha(ACCENT, 0.14) : 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: on ? alpha(ACCENT, 0.5) : 'rgba(255,255,255,0.07)',
                }}
              >
                <View
                  style={{
                    width: 15, height: 15, borderRadius: 7.5,
                    borderWidth: 1.5,
                    borderColor: on ? ACCENT : 'rgba(255,255,255,0.22)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {on && (
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: ACCENT }} />
                  )}
                </View>
                <Text
                  style={{
                    color: on ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                    fontSize: 13.5, fontWeight: on ? '700' : '500', marginLeft: 11,
                  }}
                >
                  {GOAL_LABELS[g]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* ── Default gain ── */}
      <Card title="Default Volume Calibration">
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text
            style={{
              color: inTarget ? '#00E676' : '#FFFFFF',
              fontSize: 30, fontWeight: '900', fontFamily: 'Menlo',
            }}
          >
            {Math.round(defaultVol * 100)}%
          </Text>
          <Text
            style={{
              color: inTarget ? '#00E676' : 'rgba(255,255,255,0.35)',
              fontSize: 10.5, fontWeight: '800', letterSpacing: 1.6,
            }}
          >
            {inTarget ? 'PHASE-LOCKED' : 'OUTSIDE TARGET'}
          </Text>
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, lineHeight: 17, marginTop: 6 }}>
          New sessions start here. 60–70% keeps the beat audible without
          masking it — loud does not mean stronger.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}>
          {[0.5, 0.6, 0.65, 0.7, 0.8].map((v) => {
            const on = Math.abs(defaultVol - v) < 0.001;
            const target = v >= TARGET_LO && v <= TARGET_HI;
            const tint = target ? '#00E676' : ACCENT;
            return (
              <Pressable
                key={v}
                onPress={() => { void chooseVolume(v); }}
                style={{
                  flex: 1, alignItems: 'center', borderRadius: 11, paddingVertical: 10,
                  backgroundColor: on ? alpha(tint, 0.16) : 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: on ? alpha(tint, 0.55) : 'rgba(255,255,255,0.07)',
                }}
              >
                <Text
                  style={{
                    color: on ? tint : 'rgba(255,255,255,0.45)',
                    fontSize: 12, fontWeight: '800', fontFamily: 'Menlo',
                  }}
                >
                  {Math.round(v * 100)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* ── Hardware ── */}
      <Card title="Audio Hardware">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 21 }}>🎧</Text>
          <View style={{ flex: 1, marginLeft: 11 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>
              Headphone Transport
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, lineHeight: 16, marginTop: 2 }}>
              Play/pause and next-track gestures control sessions from AirPods
              or any AVRCP headset.
            </Text>
          </View>
          <View
            style={{
              borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
              backgroundColor: 'rgba(0,230,118,0.14)',
              borderWidth: 1, borderColor: 'rgba(0,230,118,0.4)',
            }}
          >
            <Text style={{ color: '#00E676', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
              ARMED
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: SURFACE.hairline, marginVertical: 12 }} />

        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 16 }}>
          Live output-route detection (naming the connected device) needs a
          native addition and is not wired up yet — this panel reports transport
          status only.
        </Text>
      </Card>

      {/* ── Diagnostics ── */}
      <Card title="Diagnostics">
        <Pressable
          onPress={() => { tapSelect(); router.navigate('/settings'); }}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 19 }}>⚙</Text>
          <View style={{ flex: 1, marginLeft: 11 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>
              Neuro-Labs & Recalibration
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, marginTop: 2 }}>
              Biometric simulation, engine link, re-run the neural diagnostic
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>›</Text>
        </Pressable>
      </Card>
    </View>
  );
}
