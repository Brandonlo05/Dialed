/**
 * DIALED NEURO-LABS — hidden diagnostic control panel (Settings).
 *
 * Simulates the biometric inputs (RMSSD, somatic restlessness) that the
 * Apple Watch pipeline will eventually stream, and shows what the LQR
 * state-estimation layer WOULD command in response. Display-only by
 * default; the optional Live Engine Link pushes the commanded SMR depth
 * to the running native engine via the existing setAsymmetricSMR bridge.
 *
 * The state readout here is a mock of the controller's decision surface —
 * the real state-space estimator lands with the watch biometric streams.
 *
 * Sliders are hand-built on PanResponder (no external UI deps) with
 * impactLight haptic detents per step increment.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { PanResponder, Pressable, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { NEON } from '../constants/theme';
import { setAsymmetricSMR } from '../services/audioEngine';
import { tapSelect, tick } from '../services/haptics';
import { getCachedProfile } from '../services/userProfile';

// ── Hand-built detented slider ───────────────────────────────────────────────

type LabSliderProps = {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  accent: string;
  onChange: (v: number) => void;
  onRelease?: (v: number) => void;
};

function LabSlider({ label, unit, min, max, step, value, accent, onChange, onRelease }: LabSliderProps) {
  const widthRef = useRef(1);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Latest-handler refs so the PanResponder (created once) never goes stale
  const touchRef = useRef<(x: number) => void>(() => {});
  touchRef.current = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    const raw = min + ratio * (max - min);
    const stepped = Math.round(raw / step) * step;
    if (stepped !== valueRef.current) {
      tick(); // mechanical detent per increment
      onChange(stepped);
    }
  };
  const releaseRef = useRef<() => void>(() => {});
  releaseRef.current = () => onRelease?.(valueRef.current);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant:   (e) => touchRef.current(e.nativeEvent.locationX),
      onPanResponderMove:    (e) => touchRef.current(e.nativeEvent.locationX),
      onPanResponderRelease: () => releaseRef.current(),
      onPanResponderTerminate: () => releaseRef.current(),
    }),
  ).current;

  const ratio = (value - min) / (max - min);

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-[10px] font-bold uppercase tracking-[1.5px] text-dialed-muted">
          {label}
        </Text>
        <Text
          className="font-mono text-xs font-bold"
          style={{ color: accent, fontVariant: ['tabular-nums'] }}
        >
          {value}
          {unit}
        </Text>
      </View>

      {/* Track — generous hit area, thin neon rail */}
      <View
        {...pan.panHandlers}
        onLayout={(e) => { widthRef.current = Math.max(1, e.nativeEvent.layout.width); }}
        className="justify-center"
        style={{ height: 36 }}
      >
        <View
          className="h-1 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        />
        <View
          className="absolute h-1 rounded-full"
          style={{
            width: `${ratio * 100}%`,
            backgroundColor: accent,
            shadowColor: accent,
            shadowOpacity: 0.8,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
        {/* Thumb */}
        <View
          className="absolute h-4 w-4 rounded-full"
          style={{
            left: `${ratio * 100}%`,
            marginLeft: -8,
            backgroundColor: '#0a0a0f',
            borderWidth: 2,
            borderColor: accent,
            shadowColor: accent,
            shadowOpacity: 0.9,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          }}
        />
      </View>
    </View>
  );
}

// ── Mock LQR decision surface ────────────────────────────────────────────────

type LabState = 'drift' | 'resonance' | 'nominal';

function estimateState(rmssd: number, restlessness: number): LabState {
  if (rmssd <= 40 && restlessness >= 60) return 'drift';
  if (rmssd >= 80 && restlessness <= 30) return 'resonance';
  return 'nominal';
}

/** Mock control output: stress index → commanded SMR depth (0.55–0.95). */
function commandedSmrDepth(rmssd: number, restlessness: number): number {
  const rmssdNorm = (rmssd - 10) / 140;                    // 0 (stress) … 1 (rest)
  const stress = 0.6 * (1 - rmssdNorm) + 0.4 * (restlessness / 100);
  return Math.min(0.95, Math.max(0.55, 0.55 + 0.4 * stress));
}

const STATE_DISPLAY: Record<LabState, { color: string; text: string }> = {
  drift: {
    color: NEON.orange,
    text: 'STATE: ATTENTION DRIFT DETECTED — INCREASING SMR DEPTH',
  },
  resonance: {
    color: NEON.green,
    text: 'STATE: RESONANCE MET — OPTIMIZING COGNITIVE EFFICIENCY',
  },
  nominal: {
    color: NEON.cyan,
    text: 'STATE: NOMINAL — TRACKING BASELINE',
  },
};

// ── Panel ────────────────────────────────────────────────────────────────────

export function NeuroLab() {
  const [expanded, setExpanded] = useState(false);
  const [rmssd, setRmssd] = useState(80);          // ms — mid-range default
  const [restlessness, setRestlessness] = useState(30); // % accelerometer variance
  const [liveLink, setLiveLink] = useState(false);

  const profile = getCachedProfile();
  const smrArmed = profile?.cognitive === 'adhd' || liveLink;
  const state = estimateState(rmssd, restlessness);
  const depth = commandedSmrDepth(rmssd, restlessness);
  const display = STATE_DISPLAY[state];
  // ADHD calibration clamps into the 12–15 SMR band; default mid-band otherwise
  const smrHz = 13.5;

  /** Push the commanded depth to the running engine (on slider release only). */
  function pushToEngine(_v: number) {
    if (!liveLink) return;
    void setAsymmetricSMR(true, smrHz, depth);
  }

  function toggleLiveLink(v: boolean) {
    tapSelect();
    setLiveLink(v);
    if (v) {
      void setAsymmetricSMR(true, smrHz, depth);
    } else {
      // Restore the profile's own configuration when the lab releases control
      void setAsymmetricSMR(profile?.cognitive === 'adhd', smrHz, 0.85);
    }
  }

  return (
    <View>
      <Text className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
        Dialed Neuro-Labs
      </Text>

      <View
        className="overflow-hidden rounded-2xl"
        style={{
          backgroundColor: '#000000',
          borderWidth: 1,
          borderColor: `${NEON.violet}55`,
          shadowColor: NEON.violet,
          shadowOpacity: expanded ? 0.45 : 0.2,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
          elevation: expanded ? 12 : 4,
        }}
      >
        {/* ── Header (tap to reveal) ──────────────────────────────────────── */}
        <Pressable
          onPress={() => { tapSelect(); setExpanded((e) => !e); }}
          className="flex-row items-center px-4 py-4"
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${NEON.violet}1A`,
              borderWidth: 1,
              borderColor: `${NEON.violet}45`,
            }}
          >
            <Text allowFontScaling={false} style={{ fontSize: 15 }}>⚗</Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-sm font-bold tracking-tight text-dialed-stat">
              Neuro-Diagnostic Control Panel
            </Text>
            <Text className="mt-0.5 text-[10px] text-dialed-muted">
              LQR state-space simulator · pre-biometric test bench
            </Text>
          </View>
          <Text className="text-dialed-muted" style={{ fontSize: 12 }}>
            {expanded ? '▾' : '▸'}
          </Text>
        </Pressable>

        {/* ── Diagnostics (hidden until expanded) ─────────────────────────── */}
        {expanded && (
          <Animated.View entering={FadeInDown.springify().damping(18)} className="px-4 pb-5">
            <View className="mb-4 h-px" style={{ backgroundColor: `${NEON.violet}25` }} />

            {/* Live biometric simulators */}
            <Text className="mb-3 text-[9px] font-bold uppercase tracking-[2.5px]" style={{ color: NEON.violetSoft }}>
              Live Biometric Simulators
            </Text>
            <LabSlider
              label="Simulated HRV (RMSSD)"
              unit="ms"
              min={10}
              max={150}
              step={5}
              value={rmssd}
              accent={NEON.cyan}
              onChange={setRmssd}
              onRelease={pushToEngine}
            />
            <LabSlider
              label="Simulated Somatic Restlessness"
              unit="%"
              min={0}
              max={100}
              step={5}
              value={restlessness}
              accent={NEON.pink}
              onChange={setRestlessness}
              onRelease={pushToEngine}
            />

            {/* Real-time state estimation */}
            <Text className="mb-2 mt-1 text-[9px] font-bold uppercase tracking-[2.5px]" style={{ color: NEON.violetSoft }}>
              State Estimation
            </Text>
            <View
              className="rounded-xl px-3.5 py-3"
              style={{
                backgroundColor: `${display.color}12`,
                borderWidth: 1,
                borderColor: `${display.color}50`,
                shadowColor: display.color,
                shadowOpacity: state === 'nominal' ? 0 : 0.4,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <Text className="text-[10px] font-bold leading-4 tracking-[0.5px]" style={{ color: display.color }}>
                {display.text}
              </Text>
              <Text className="mt-1.5 font-mono text-[10px] text-dialed-muted" style={{ fontVariant: ['tabular-nums'] }}>
                u(t) = −K·x̂  →  commanded SMR depth {depth.toFixed(2)}
              </Text>
            </View>

            {/* Audio bypass diagnostics */}
            <Text className="mb-2 mt-4 text-[9px] font-bold uppercase tracking-[2.5px]" style={{ color: NEON.violetSoft }}>
              Audio Bypass Diagnostics
            </Text>
            <View
              className="rounded-xl px-3.5 py-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <Text className="font-mono text-[10px] leading-4 text-dialed-muted">
                {smrArmed
                  ? '[NATIVE STREAM] Left Channel: AM-SMR Module Connected | Right Channel: High-Valence Isolated'
                  : '[NATIVE STREAM] Left Channel: Binaural Carrier | Right Channel: Carrier + Beat Offset'}
              </Text>
            </View>

            {/* Live engine link */}
            <View className="mt-4 flex-row items-center">
              <View className="flex-1 pr-4">
                <Text className="text-xs font-semibold text-dialed-stat">Live Engine Link</Text>
                <Text className="mt-0.5 text-[10px] leading-4 text-dialed-muted">
                  Push commanded SMR depth to the running engine on slider release
                </Text>
              </View>
              <Switch
                value={liveLink}
                onValueChange={toggleLiveLink}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: NEON.violet }}
                thumbColor={liveLink ? '#e8e6f3' : '#4a4558'}
              />
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
