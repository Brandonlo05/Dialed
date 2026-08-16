/**
 * TAB 2 · LIBRARY — the deliberate browse surface.
 *
 * Where NeuroHack answers "fix how I feel right now", the Library answers
 * "what should I put on for the next hour". Structure, top to bottom:
 *
 *   Daily Rep hero      today's mission, always first
 *   Category pills      ALL · FOCUS · PERFORMANCE · RECOVERY
 *   Clinical Presets    self-driving phase machines
 *   Entrainment Modes   steady-state, calibrated to the user's profile
 *
 * Categories are a property of each protocol (see CATEGORY below) rather than
 * a second hand-maintained list, so a protocol cannot drift out of sync with
 * the filter — adding one to the union forces a category at compile time.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';

import { SURFACE, alpha } from '../../src/constants/theme';
import { FOCUS_MODES } from '../../src/constants/modes';
import { PRESET_UX_DATA, type ProgramId } from '../../src/constants/presetUx';
import { useAudioEngine } from '../../src/hooks/useAudioEngine';
import { NEURO_PRESETS } from '../../src/services/audioPresets';
import { loadDailyRep, type DailyRepStatus } from '../../src/services/dailyRep';
import { tapSelect } from '../../src/services/haptics';
import { useSession } from '../../src/services/sessionStore';

// ── Categories ───────────────────────────────────────────────────────────────

type Category = 'all' | 'focus' | 'performance' | 'recovery';

const FILTERS: { id: Category; label: string }[] = [
  { id: 'all',         label: 'ALL' },
  { id: 'focus',       label: 'FOCUS' },
  { id: 'performance', label: 'PERFORMANCE' },
  { id: 'recovery',    label: 'RECOVERY' },
];

/**
 * Exhaustive by construction: `Record<ProgramId, …>` means adding a protocol
 * without categorising it is a type error, not a card that silently vanishes
 * from every filter.
 */
const CATEGORY: Record<ProgramId, Exclude<Category, 'all'>> = {
  'standard-focus': 'focus',
  'deep-lockdown':  'focus',
  'screen-fog':     'focus',
  'caffeine-rush':  'performance',
  'clutch-mode':    'performance',
  'pre-exam':       'performance',
  'burnout':        'recovery',
  'golden-432':     'recovery',
};

// ── Rows ─────────────────────────────────────────────────────────────────────

type RowProps = {
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  hzLabel: string;
  live: boolean;
  index: number;
  onPress: () => void;
};

function ProtocolRow({ title, subtitle, icon, accent, hzLabel, live, index, onPress }: RowProps) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 26).springify().damping(18)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          borderRadius: 18, padding: 14, marginBottom: 10,
          backgroundColor: live ? alpha(accent, 0.11) : SURFACE.glass,
          borderWidth: 1,
          borderColor: live ? alpha(accent, 0.45) : SURFACE.hairline,
          shadowColor: accent,
          shadowOpacity: live ? 0.4 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <View
          style={{
            width: 44, height: 44, borderRadius: 14,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: alpha(accent, 0.13),
            borderWidth: 1, borderColor: alpha(accent, 0.32),
          }}
        >
          <Text style={{ fontSize: 19 }}>{icon}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {live && (
              <View
                style={{
                  width: 6, height: 6, borderRadius: 3, backgroundColor: accent,
                  shadowColor: accent, shadowOpacity: 1, shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
            )}
            <Text style={{ color: '#FFFFFF', fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3 }}>
              {title}
            </Text>
          </View>
          <Text
            style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11.5, lineHeight: 16, marginTop: 2 }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>

        <Text
          style={{
            color: alpha(accent, 0.9), fontSize: 10, fontWeight: '800',
            fontFamily: 'Menlo', marginLeft: 8,
          }}
        >
          {hzLabel}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: 'rgba(255,255,255,0.32)', fontSize: 9.5, fontWeight: '800',
        letterSpacing: 3, textTransform: 'uppercase',
        marginTop: 22, marginBottom: 11,
      }}
    >
      {children}
    </Text>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const { playProtocolAndNavigate, playDailyRep } = useAudioEngine();
  const activeId = useSession((s) => s.protocolId);
  const [filter, setFilter] = useState<Category>('all');
  const [rep, setRep] = useState<DailyRepStatus | null>(null);

  useEffect(() => { void loadDailyRep().then(setRep); }, []);

  const show = (id: ProgramId) => filter === 'all' || CATEGORY[id] === filter;

  const presets = NEURO_PRESETS.filter((p) => show(p.id as ProgramId));
  const modes = FOCUS_MODES.filter((m) => show(m.id as ProgramId));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 18 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 14, marginBottom: 16 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.38)', fontSize: 10.5, fontWeight: '700',
              letterSpacing: 4, textTransform: 'uppercase',
            }}
          >
            Protocol Library
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 2 }}>
            Library
          </Text>
        </View>

        {/* ── Daily Rep hero ── */}
        {rep && (
          <Animated.View entering={FadeInDown.springify().damping(18)}>
            <Pressable
              onPress={() => { tapSelect(); void playDailyRep(rep.program.id); }}
              style={({ pressed }) => ({
                borderRadius: 22, padding: 18, marginBottom: 6,
                backgroundColor: alpha(rep.program.accent, 0.1),
                borderWidth: 1, borderColor: alpha(rep.program.accent, 0.42),
                shadowColor: rep.program.accent,
                shadowOpacity: 0.45, shadowRadius: 26,
                shadowOffset: { width: 0, height: 0 },
                transform: [{ scale: pressed ? 0.985 : 1 }],
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text
                  style={{
                    color: alpha(rep.program.accent, 0.95), fontSize: 9.5,
                    fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase',
                  }}
                >
                  Daily Cognitive Rep
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'Menlo' }}>
                  DAY {rep.currentDay}/10 · 🔥 {rep.streakCount}
                </Text>
              </View>

              <Text style={{ color: '#FFFFFF', fontSize: 23, fontWeight: '900', letterSpacing: -0.6, marginTop: 9 }}>
                {rep.program.title}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>
                {rep.completedToday
                  ? 'Done today — run it again any time.'
                  : `8 minutes at ${rep.program.hz} Hz. Tap to start.`}
              </Text>

              <View
                style={{
                  marginTop: 13, alignSelf: 'flex-start', borderRadius: 999,
                  paddingHorizontal: 13, paddingVertical: 6,
                  backgroundColor: alpha(rep.program.accent, 0.16),
                  borderWidth: 1, borderColor: alpha(rep.program.accent, 0.45),
                }}
              >
                <Text
                  style={{
                    color: rep.program.accent, fontSize: 11, fontWeight: '900',
                    letterSpacing: 2.4, textTransform: 'uppercase',
                  }}
                >
                  {rep.completedToday ? 'Run Again' : 'Start Rep'}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Category pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 16 }}
        >
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => { tapSelect(); setFilter(f.id); }}
                style={{
                  borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8,
                  backgroundColor: on ? 'rgba(255,255,255,0.13)' : SURFACE.glass,
                  borderWidth: 1,
                  borderColor: on ? 'rgba(255,255,255,0.3)' : SURFACE.hairline,
                }}
              >
                <Text
                  style={{
                    color: on ? '#FFFFFF' : 'rgba(255,255,255,0.44)',
                    fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Clinical presets ── */}
        {presets.length > 0 && <SectionHeader>Clinical Presets</SectionHeader>}
        {presets.map((p, i) => (
          <ProtocolRow
            key={p.id}
            index={i}
            title={p.title}
            subtitle={p.subtitle}
            icon={p.icon}
            accent={p.accent}
            hzLabel={`${p.displayHz} Hz`}
            live={activeId === p.id}
            onPress={() => { void playProtocolAndNavigate(p.id); }}
          />
        ))}

        {/* ── Entrainment modes ── */}
        {modes.length > 0 && <SectionHeader>Entrainment Modes</SectionHeader>}
        {modes.map((m, i) => (
          <ProtocolRow
            key={m.id}
            index={i}
            title={m.title}
            subtitle={m.subtitle}
            icon={m.icon}
            accent={m.accent}
            hzLabel={`${PRESET_UX_DATA[m.id as ProgramId].targetHz} Hz`}
            live={activeId === m.id}
            onPress={() => { void playProtocolAndNavigate(m.id); }}
          />
        ))}

        {/* ── Training Mode ──
            Deliberately routes to its own cockpit rather than NOW PLAYING:
            it is a tri-phasic phase machine with its own transport (advance
            phase, per-phase countdown), which a single-protocol session view
            cannot represent without losing the controls that define it. */}
        {(filter === 'all' || filter === 'performance') && (
          <>
            <SectionHeader>Training</SectionHeader>
            <ProtocolRow
              index={0}
              title="Neuromotor Drive"
              subtitle="Tri-phasic training protocol — warm-up, drive, recovery"
              icon="🏋️"
              accent="#FF3B30"
              hzLabel="TRI"
              live={false}
              onPress={() => { tapSelect(); router.navigate('/gym'); }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
