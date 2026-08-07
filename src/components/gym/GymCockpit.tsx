/**
 * Training Mode — tri-phasic tactical cockpit.
 *
 * User-facing name is deliberately "Training Mode", not "Anabolic Drive":
 * "anabolic" reads as a physiological-effect claim to App Review even
 * though no such claim appears in body copy. The physiological rationale
 * for the protocol stays in code comments (see services/gymProtocol.ts).
 *
 * One full-bleed surface that swaps theme, visualizer, telemetry and its
 * single primary action per phase. Phase transitions are immediate: the
 * action button sets state and fires the native call without awaiting, so
 * tap-to-repaint has no audio-latency dependency.
 *
 * Copy is General Wellness structure-function framing. Physiological
 * rationale lives in code comments only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSessionClock } from '../../hooks/useSessionClock';
import { celebrate, engagePreset, tapConfirm, tapSelect } from '../../services/haptics';
import {
  enterPhase,
  phaseCarrier,
  phaseFrequencyAt,
  PRIMING_SEC,
  REST_SEC,
  stopGym,
  type GymPhase,
} from '../../services/gymProtocol';

// Phase themes — directive palette
const THEME: Record<Exclude<GymPhase, 'idle'>, { color: string; label: string; kicker: string }> = {
  priming:  { color: '#FFD700', label: 'Priming',  kicker: 'Phase I · CNS Priming' },
  drive:    { color: '#FF3B30', label: 'Drive',    kicker: 'Phase II · Peak Drive' },
  recovery: { color: '#00E676', label: 'Recovery', kicker: 'Phase III · Inter-Set Recovery' },
};

const IDLE_COLOR = '#8b8798';

// Structure-function copy (no disease or mechanism-of-action claims)
const BLURB: Record<Exclude<GymPhase, 'idle'>, string> = {
  priming:
    'Ramps steadily to prepare you for effort. Supports rate of force development before your first working set.',
  drive:
    'Holds a high-intensity pulse for the duration of your set. Helps sustain drive and clears sensory fatigue while you work.',
  recovery:
    'Settles progressively downward between sets. Accelerates parasympathetic recovery so the next set starts fresh.',
};

function fmt(sec: number): string {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${sec < 0 ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Lazy import avoids a cycle: visualizer imports the protocol types only.
import { PhaseVisualizer } from './PhaseVisualizer';

export function GymCockpit() {
  const [phase, setPhase] = useState<GymPhase>('idle');
  const [setCount, setSetCount] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const running = phase !== 'idle';
  const elapsed = useSessionClock(running, startedAtRef);

  // Always release the engine if the screen unmounts mid-protocol
  useEffect(() => () => { void stopGym(); }, []);

  const go = useCallback((next: GymPhase) => {
    startedAtRef.current = next === 'idle' ? null : Date.now();
    setPhase(next);
    void enterPhase(next); // not awaited — UI repaints immediately
  }, []);

  const theme = running ? THEME[phase as Exclude<GymPhase, 'idle'>] : null;
  const color = theme?.color ?? IDLE_COLOR;
  const hz = phaseFrequencyAt(phase, elapsed);
  const carrier = phaseCarrier(phase);

  // Phase I counts up to its nominal ramp; Phase III counts the rest down
  const remaining = phase === 'recovery' ? REST_SEC - elapsed : null;
  const primingLeft = phase === 'priming' ? PRIMING_SEC - elapsed : null;

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header + route badge ─────────────────────────────────────────── */}
        <View className="mb-4 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Training Protocol
          </Text>
          <Text className="mt-0.5 text-[34px] font-black tracking-tight text-dialed-stat">
            Training Mode
          </Text>
          <View
            className="mt-2.5 self-start rounded-full px-3 py-1"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Text className="font-mono text-[9.5px] tracking-[1px] text-dialed-muted">
              {running ? 'MIXED WITH EXTERNAL MEDIA' : 'READY · PLAYS OVER YOUR MUSIC'}
            </Text>
          </View>
        </View>

        {/* ── Cockpit ──────────────────────────────────────────────────────── */}
        <View
          className="mb-5 overflow-hidden rounded-3xl"
          style={{
            backgroundColor: '#000000',
            borderWidth: 1,
            borderColor: running ? `${color}50` : 'rgba(255,255,255,0.08)',
            shadowColor: color,
            shadowOpacity: running ? 0.45 : 0.12,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: 0 },
            elevation: running ? 16 : 4,
          }}
        >
          <View className="px-5 pb-5 pt-4" style={{ backgroundColor: 'rgba(20,20,22,0.65)' }}>
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[10px] font-bold uppercase tracking-[3px]"
                style={{ color: running ? color : IDLE_COLOR }}
              >
                {theme?.kicker ?? 'Standby'}
              </Text>
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: running ? color : 'rgba(255,255,255,0.2)' }}
                />
                <Text
                  className="font-mono text-[10px] font-bold"
                  style={{ color: running ? color : IDLE_COLOR }}
                >
                  {running ? 'ENGAGED' : 'STANDBY'}
                </Text>
              </View>
            </View>

            {/* Big clock */}
            <Text
              allowFontScaling={false}
              className="mt-3 font-black tracking-tight text-dialed-stat"
              style={{ fontSize: 54, fontVariant: ['tabular-nums'] }}
            >
              {phase === 'recovery' && remaining !== null
                ? fmt(remaining)
                : phase === 'priming' && primingLeft !== null
                  ? fmt(primingLeft)
                  : fmt(elapsed)}
            </Text>
            <Text className="mt-0.5 font-mono text-[10px] tracking-[1.5px] text-dialed-muted">
              {phase === 'recovery'
                ? 'REST REMAINING'
                : phase === 'priming'
                  ? 'PRIMING REMAINING'
                  : phase === 'drive'
                    ? 'SET ELAPSED'
                    : 'NOT RUNNING'}
            </Text>

            {/* Telemetry */}
            <View
              className="mt-3.5 flex-row items-center rounded-xl px-3 py-2"
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderWidth: 1,
                borderColor: '#1A1A1E',
                gap: 14,
              }}
            >
              <Text className="font-mono text-[10px]" style={{ color, fontVariant: ['tabular-nums'] }}>
                {running ? `${hz.toFixed(1)} HZ` : '— HZ'}
              </Text>
              <Text className="font-mono text-[10px] text-dialed-muted">
                {running ? `CARRIER ${carrier}` : 'CARRIER —'}
              </Text>
              {phase === 'drive' && (
                <Text className="font-mono text-[10px]" style={{ color: '#FF3B30' }}>
                  ISO·40
                </Text>
              )}
              <Text
                className="ml-auto font-mono text-[10px] text-dialed-muted"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                SETS {setCount}
              </Text>
            </View>

            {/* Visualizer */}
            <View className="mt-3">
              <PhaseVisualizer phase={phase} hz={running ? hz : 10} color={running ? color : IDLE_COLOR} />
            </View>

            {running && (
              <Text className="mt-1 text-xs leading-[19px] text-dialed-muted">
                {BLURB[phase as Exclude<GymPhase, 'idle'>]}
              </Text>
            )}
          </View>
        </View>

        {/* ── Primary action ───────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <ActionButton
            label="Begin Priming"
            color={THEME.priming.color}
            onPress={() => { engagePreset(); go('priming'); }}
          />
        )}
        {phase === 'priming' && (
          <ActionButton
            label="Begin Set"
            color={THEME.drive.color}
            onPress={() => { tapConfirm(); go('drive'); }}
          />
        )}
        {phase === 'drive' && (
          <ActionButton
            label="Complete Set"
            color={THEME.recovery.color}
            onPress={() => {
              celebrate();
              setSetCount((n) => n + 1);
              go('recovery');
            }}
          />
        )}
        {phase === 'recovery' && (
          <ActionButton
            label="Begin Set"
            color={THEME.drive.color}
            onPress={() => { tapConfirm(); go('drive'); }}
          />
        )}

        {running && (
          <Pressable
            onPress={() => {
              tapSelect();
              startedAtRef.current = null;
              setPhase('idle');
              setSetCount(0);
              void stopGym();
            }}
            className="mt-3 items-center rounded-2xl py-3.5"
            style={{
              backgroundColor: 'rgba(248,113,113,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.35)',
            }}
          >
            <Text className="text-xs font-bold uppercase tracking-[2px]" style={{ color: '#f87171' }}>
              End Workout
            </Text>
          </Pressable>
        )}

        <Text className="mt-5 text-[10.5px] leading-[17px] text-dialed-muted">
          Gym Mode plays underneath your own music. During a working set the system
          lowers other audio so the pulse stays audible, then hands it back for rest.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center rounded-2xl py-5"
      style={{
        backgroundColor: `${color}1C`,
        borderWidth: 1.5,
        borderColor: `${color}60`,
        shadowColor: color,
        shadowOpacity: 0.5,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
        elevation: 14,
      }}
    >
      <Text className="text-[15px] font-black uppercase tracking-[3px]" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}
