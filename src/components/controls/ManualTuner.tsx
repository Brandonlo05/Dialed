/**
 * Manual Tuner — hyper-custom frequency synthesizer card (bottom of the
 * Entrainment Modes list). Expands into an interactive playground:
 *
 * - 1–100 Hz slider in 0.5 Hz steps (hand-built PanResponder, no deps)
 * - Central live Hz readout + dynamic brainwave-band sub-label
 * - ENGAGE starts the native engine at a 200 Hz carrier with the tuned
 *   binaural beat; dragging while live retunes the running engine
 * - Light haptic detent per whole Hz, firmer notch on band crossings
 * - Last tuned frequency persists (AsyncStorage) across launches
 * - Cleans up on unmount and yields gracefully when another session starts
 *
 * Note on channel math: the native engine renders L = carrier and
 * R = carrier + beat. Perceptually this is the same interaural difference
 * as a ±beat/2 split around the carrier; the web demo uses the split form.
 */

import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { NEON } from '../../constants/theme';
import { setBeatFrequency, startAudioSession, stopAudioSession } from '../../services/audioEngine';
import { notch, tapConfirm, tapSelect, tick } from '../../services/haptics';
import { loadJson, saveJson } from '../../services/storage';
import { getCachedProfile } from '../../services/userProfile';

const HZ_MIN = 1;
const HZ_MAX = 100;
const HZ_STEP = 0.5;
const HZ_KEY = '@dialed/tuner-hz';
const TUNER_CARRIER = 200;

// ── Brainwave band zones ─────────────────────────────────────────────────────

type Band = { name: string; desc: string; color: string; maxHz: number };

const BANDS: Band[] = [
  { maxHz: 4,   name: 'Delta', color: '#7c5cff', desc: 'Deep Restorative Reset' },
  { maxHz: 7.5, name: 'Theta', color: '#f472b6', desc: 'High Plasticity & Deep Visualization' },
  { maxHz: 12,  name: 'Alpha', color: '#22d3ee', desc: 'Calm Vigilance & Somatosensory Gating' },
  { maxHz: 15,  name: 'SMR',   color: '#4ade80', desc: 'Sensory Stillness & Focus Gate' },
  { maxHz: 30,  name: 'Beta',  color: '#fb923c', desc: 'Active Analytical Processing' },
  { maxHz: 100, name: 'Gamma', color: '#f87171', desc: 'Synaptic Synchronization & High Alertness' },
];

export function bandForHz(hz: number): Band {
  for (const band of BANDS) {
    if (hz <= band.maxHz) return band;
  }
  return BANDS[BANDS.length - 1];
}

// ── Component ────────────────────────────────────────────────────────────────

type ManualTunerProps = {
  /** Dashboard hook — winds down any running program session first. */
  onBeforeStart?: () => Promise<void> | void;
  /** True while a dashboard program session is playing (tuner yields). */
  externalSessionActive?: boolean;
};

export function ManualTuner({ onBeforeStart, externalSessionActive }: ManualTunerProps) {
  const [expanded, setExpanded] = useState(false);
  const [hz, setHz] = useState(10);
  const [active, setActive] = useState(false);

  const widthRef = useRef(1);
  const hzRef = useRef(hz);
  hzRef.current = hz;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Restore the last tuned frequency
  useEffect(() => {
    void loadJson<number>(HZ_KEY).then((saved) => {
      if (typeof saved === 'number' && saved >= HZ_MIN && saved <= HZ_MAX) setHz(saved);
    });
  }, []);

  // Unmount: never leave the synthesizer running
  useEffect(
    () => () => {
      if (activeRef.current) void stopAudioSession();
    },
    [],
  );

  // If a dashboard program takes the engine, the tuner yields its state
  useEffect(() => {
    if (externalSessionActive && active) setActive(false);
  }, [externalSessionActive, active]);

  const touchRef = useRef<(x: number) => void>(() => {});
  touchRef.current = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    const raw = HZ_MIN + ratio * (HZ_MAX - HZ_MIN);
    const next = Math.round(raw / HZ_STEP) * HZ_STEP;
    const prev = hzRef.current;
    if (next === prev) return;

    if (bandForHz(next).name !== bandForHz(prev).name) {
      notch(); // firmer detent crossing into a new brainwave band
    } else if (Number.isInteger(next)) {
      tick(); // light detent per whole Hz
    }

    setHz(next);
    if (activeRef.current) void setBeatFrequency(next); // live retune
  };
  const releaseRef = useRef<() => void>(() => {});
  releaseRef.current = () => { void saveJson(HZ_KEY, hzRef.current); };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => touchRef.current(e.nativeEvent.locationX),
      onPanResponderMove: (e) => touchRef.current(e.nativeEvent.locationX),
      onPanResponderRelease: () => releaseRef.current(),
      onPanResponderTerminate: () => releaseRef.current(),
    }),
  ).current;

  async function engage() {
    tapConfirm();
    await onBeforeStart?.();
    const scaffold = getCachedProfile()?.sensoryScaffolding === 'high-valence-cyberpunk';
    await startAudioSession({
      carrierHz: TUNER_CARRIER,
      beatHz: hz,
      brownNoiseEnabled: scaffold, // sensory scaffolding bias applies here too
    });
    setActive(true);
  }

  async function disengage() {
    tapSelect();
    setActive(false);
    await stopAudioSession();
  }

  const band = bandForHz(hz);
  const ratio = (hz - HZ_MIN) / (HZ_MAX - HZ_MIN);

  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl"
      style={{
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: active ? `${band.color}60` : 'rgba(255,255,255,0.09)',
        shadowColor: band.color,
        shadowOpacity: active ? 0.45 : expanded ? 0.2 : 0,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 0 },
        elevation: active ? 12 : 4,
      }}
    >
      {/* ── Header (tap to expand) ─────────────────────────────────────────── */}
      <Pressable
        onPress={() => { tapSelect(); setExpanded((e) => !e); }}
        className="flex-row items-center px-5 py-4"
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: `${band.color}16`,
            borderWidth: 1,
            borderColor: `${band.color}45`,
          }}
        >
          <Text allowFontScaling={false} style={{ fontSize: 18, color: NEON.text }}>∿</Text>
        </View>
        <View className="ml-3 flex-1">
          <View className="flex-row items-center" style={{ gap: 7 }}>
            {active && (
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
            )}
            <Text className="text-[17px] font-bold tracking-tight text-dialed-stat">
              Manual Tuner
            </Text>
          </View>
          <Text className="text-xs leading-[18px] text-dialed-muted">
            {active
              ? `Live · ${hz.toFixed(1)} Hz ${band.name} on a ${TUNER_CARRIER} Hz carrier`
              : 'Hyper-custom synthesizer · 1–100 Hz freeform entrainment'}
          </Text>
        </View>
        <Text className="text-dialed-muted" style={{ fontSize: 12 }}>
          {expanded ? '▾' : '▸'}
        </Text>
      </Pressable>

      {/* ── Playground ─────────────────────────────────────────────────────── */}
      {expanded && (
        <Animated.View entering={FadeInDown.springify().damping(18)} className="px-5 pb-5">
          <View className="mb-4 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

          {/* Central live readout */}
          <View className="items-center">
            <Text
              allowFontScaling={false}
              className="font-black tracking-tight text-dialed-stat"
              style={{ fontSize: 52, lineHeight: 56, fontVariant: ['tabular-nums'] }}
            >
              {hz.toFixed(1)}
              <Text style={{ fontSize: 20, color: NEON.muted }}> Hz</Text>
            </Text>
            <View
              className="mt-2 flex-row items-center rounded-full px-3 py-1"
              style={{
                backgroundColor: `${band.color}14`,
                borderWidth: 1,
                borderColor: `${band.color}45`,
                gap: 6,
              }}
            >
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: band.color }} />
              <Text className="text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: band.color }}>
                {band.name}
              </Text>
              <Text className="text-[11px] text-dialed-muted">{band.desc}</Text>
            </View>
          </View>

          {/* Frequency slider */}
          <View
            {...pan.panHandlers}
            onLayout={(e) => { widthRef.current = Math.max(1, e.nativeEvent.layout.width); }}
            className="mt-5 justify-center"
            style={{ height: 40 }}
          >
            <View className="h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            {/* Band boundary etchings */}
            {BANDS.slice(0, -1).map((b) => (
              <View
                key={b.name}
                className="absolute h-2.5 w-px"
                style={{
                  left: `${((b.maxHz - HZ_MIN) / (HZ_MAX - HZ_MIN)) * 100}%`,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                }}
              />
            ))}
            <View
              className="absolute h-1 rounded-full"
              style={{
                width: `${ratio * 100}%`,
                backgroundColor: band.color,
                shadowColor: band.color,
                shadowOpacity: 0.8,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
            <View
              className="absolute h-4 w-4 rounded-full"
              style={{
                left: `${ratio * 100}%`,
                marginLeft: -8,
                backgroundColor: '#0a0a0f',
                borderWidth: 2,
                borderColor: band.color,
                shadowColor: band.color,
                shadowOpacity: 0.9,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
                elevation: 8,
              }}
            />
          </View>

          {/* Transport */}
          <Pressable
            onPress={() => { void (active ? disengage() : engage()); }}
            className="mt-4 items-center rounded-2xl py-3.5"
            style={{
              backgroundColor: active ? 'rgba(248,113,113,0.12)' : `${band.color}1C`,
              borderWidth: 1,
              borderColor: active ? 'rgba(248,113,113,0.4)' : `${band.color}55`,
            }}
          >
            <Text
              className="text-[13px] font-black uppercase tracking-[3px]"
              style={{ color: active ? NEON.red : band.color }}
            >
              {active ? 'Stop Audio / Disengage' : 'Engage Frequency'}
            </Text>
          </Pressable>

          <Text className="mt-3 text-center font-mono text-[10px] text-dialed-muted">
            L {TUNER_CARRIER} Hz · R {TUNER_CARRIER} + {hz.toFixed(1)} Hz · binaural Δ {hz.toFixed(1)} Hz
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
