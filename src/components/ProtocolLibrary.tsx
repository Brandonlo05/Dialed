/**
 * Protocol Library — the dashboard's single browse surface.
 *
 * Replaces two flat card stacks (8 cards, ~340pt of scroll) with one glass
 * row that opens a segmented bottom-sheet drawer. The dashboard keeps four
 * surfaces; everything else lives one tap away.
 *
 * Segments: PRESETS (clinical programs) · MODES (entrainment bands) ·
 * TUNER (freeform synthesizer, rendered inline).
 *
 * Motion is Reanimated shared-value driven (UI thread). The sheet lives in
 * a transparent Modal so it overlays the tab bar, matching CommandSheet.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FOCUS_MODES, type FocusModeId } from '../constants/modes';
import type { ProgramId } from '../constants/presetUx';
import { NEON } from '../constants/theme';
import { NEURO_PRESETS, type NeuroPresetId } from '../services/audioPresets';
import { tapSelect } from '../services/haptics';
import { ManualTuner } from './controls/ManualTuner';

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H = Math.min(SCREEN_H * 0.82, 700);

export type LibrarySegment = 'presets' | 'modes' | 'tuner';

const SEGMENTS: { id: LibrarySegment; label: string }[] = [
  { id: 'presets', label: 'Presets' },
  { id: 'modes', label: 'Modes' },
  { id: 'tuner', label: 'Tuner' },
];

// ── Dashboard entry row ──────────────────────────────────────────────────────

export function ProtocolLibraryRow({
  count,
  activeLabel,
  onPress,
}: {
  count: number;
  activeLabel: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-6 overflow-hidden rounded-2xl"
      style={{
        borderWidth: 1,
        borderColor: activeLabel ? `${NEON.violet}45` : 'rgba(255,255,255,0.08)',
        backgroundColor: '#000000',
      }}
    >
      <View
        className="flex-row items-center px-5 py-4"
        style={{ backgroundColor: 'rgba(20,20,22,0.65)' }}
      >
        <View
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `${NEON.violet}16`,
            borderWidth: 1,
            borderColor: `${NEON.violet}40`,
          }}
        >
          <Text allowFontScaling={false} style={{ fontSize: 16, color: NEON.text }}>
            ☰
          </Text>
        </View>
        <View className="ml-3.5 flex-1">
          <Text className="text-[15px] font-bold tracking-tight text-dialed-stat">
            Browse Protocols
          </Text>
          <Text className="mt-0.5 font-mono text-[10px] text-dialed-muted">
            {activeLabel ? `RUNNING · ${activeLabel.toUpperCase()}` : `${count} AVAILABLE`}
          </Text>
        </View>
        <Text className="text-dialed-muted" style={{ fontSize: 15 }}>
          ›
        </Text>
      </View>
    </Pressable>
  );
}

// ── Library row ──────────────────────────────────────────────────────────────

function LibraryRow({
  icon,
  title,
  subtitle,
  badge,
  accent,
  active,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  accent: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-2.5 overflow-hidden rounded-2xl"
      style={{
        borderWidth: 1,
        borderColor: active ? accent : 'rgba(255,255,255,0.08)',
        shadowColor: accent,
        shadowOpacity: active ? 0.4 : 0,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
        elevation: active ? 10 : 0,
      }}
    >
      <LinearGradient
        colors={
          active
            ? [`${accent}26`, 'rgba(6,6,9,0.97)']
            : ['rgba(255,255,255,0.045)', 'rgba(255,255,255,0.02)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="flex-row items-center px-4 py-3.5"
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{
            backgroundColor: active ? `${accent}28` : 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: active ? `${accent}55` : 'rgba(255,255,255,0.08)',
          }}
        >
          <Text allowFontScaling={false} style={{ fontSize: 15, color: NEON.text }}>
            {icon}
          </Text>
        </View>
        <View className="ml-3 flex-1 pr-2">
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {active && (
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            )}
            <Text className="text-[14.5px] font-bold text-dialed-stat">{title}</Text>
          </View>
          <Text className="mt-0.5 text-[11px] leading-4 text-dialed-muted" numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        {badge && (
          <View
            className="rounded-full px-2 py-0.5"
            style={{
              backgroundColor: `${accent}14`,
              borderWidth: 1,
              borderColor: `${accent}40`,
            }}
          >
            <Text
              className="font-mono text-[9px] font-bold"
              style={{ color: accent, fontVariant: ['tabular-nums'] }}
            >
              {badge}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

export type ProtocolLibraryProps = {
  visible: boolean;
  segment: LibrarySegment;
  onSegmentChange: (s: LibrarySegment) => void;
  activeProgram: ProgramId | null;
  /** Title override for the user's tailored program (personalized voice). */
  tailoredProgramId: ProgramId;
  tailoredTitle: string;
  tailoredSubtitle: string;
  onSelect: (id: ProgramId) => void;
  onClose: () => void;
  /** Passed through to the inline tuner so it can yield the engine. */
  onTunerBeforeStart: () => Promise<void> | void;
  externalSessionActive: boolean;
};

export function ProtocolLibrary({
  visible,
  segment,
  onSegmentChange,
  activeProgram,
  tailoredProgramId,
  tailoredTitle,
  tailoredSubtitle,
  onSelect,
  onClose,
  onTunerBeforeStart,
  externalSessionActive,
}: ProtocolLibraryProps) {
  const ty = useSharedValue(SHEET_H);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      ty.value = SHEET_H;
      backdrop.value = 0;
      ty.value = withSpring(0, { damping: 22, stiffness: 180 });
      backdrop.value = withTiming(1, { duration: 220 });
    }
  }, [visible, ty, backdrop]);

  function dismiss(after: () => void) {
    backdrop.value = withTiming(0, { duration: 200 });
    ty.value = withTiming(SHEET_H, { duration: 240 }, (finished) => {
      if (finished) runOnJS(after)();
    });
  }

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!visible) return null;

  return (
    <Modal transparent visible statusBarTranslucent onRequestClose={() => dismiss(onClose)}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)' },
          backdropStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => dismiss(onClose)} />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: SHEET_H,
            backgroundColor: '#000000',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            shadowColor: NEON.violet,
            shadowOpacity: 0.4,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: -8 },
            elevation: 30,
            overflow: 'hidden',
          },
          sheetStyle,
        ]}
      >
        <View className="items-center pb-1 pt-3">
          <View className="h-1 w-10 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </View>

        {/* Header */}
        <View className="flex-row items-center px-6 pb-3 pt-2">
          <View className="flex-1">
            <Text className="text-[10px] font-bold uppercase tracking-[3.5px] text-dialed-muted">
              Library
            </Text>
            <Text className="mt-0.5 text-[22px] font-black tracking-tight text-dialed-stat">
              Protocols
            </Text>
          </View>
          <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
            <Text style={{ color: NEON.muted, fontSize: 17 }}>✕</Text>
          </Pressable>
        </View>

        {/* Segmented control */}
        <View className="mx-6 mb-4 flex-row rounded-xl p-1" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {SEGMENTS.map((s) => {
            const on = s.id === segment;
            return (
              <Pressable
                key={s.id}
                onPress={() => { tapSelect(); onSegmentChange(s.id); }}
                className="flex-1 items-center rounded-lg py-2"
                style={{ backgroundColor: on ? `${NEON.violet}2E` : 'transparent' }}
              >
                <Text
                  className="text-[11px] font-bold uppercase tracking-[1.5px]"
                  style={{ color: on ? NEON.violetSoft : NEON.muted }}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 46 }}
          showsVerticalScrollIndicator={false}
        >
          {segment === 'presets' &&
            NEURO_PRESETS.map((p) => {
              const isTailored = (p.id as ProgramId) === tailoredProgramId;
              return (
                <LibraryRow
                  key={p.id}
                  icon={p.icon}
                  title={isTailored ? tailoredTitle : p.title}
                  subtitle={isTailored ? tailoredSubtitle : p.subtitle}
                  badge={isTailored ? 'YOURS' : p.badge}
                  accent={p.accent}
                  active={activeProgram === (p.id as ProgramId)}
                  onPress={() => dismiss(() => onSelect(p.id as NeuroPresetId as ProgramId))}
                />
              );
            })}

          {segment === 'modes' &&
            FOCUS_MODES.map((m) => {
              const isTailored = (m.id as ProgramId) === tailoredProgramId;
              return (
                <LibraryRow
                  key={m.id}
                  icon={m.icon}
                  title={isTailored ? tailoredTitle : m.title}
                  subtitle={isTailored ? tailoredSubtitle : m.subtitle}
                  badge={isTailored ? 'YOURS' : `${m.beatHz} HZ`}
                  accent={m.accent}
                  active={activeProgram === (m.id as FocusModeId as ProgramId)}
                  onPress={() => dismiss(() => onSelect(m.id as FocusModeId as ProgramId))}
                />
              );
            })}

          {segment === 'tuner' && (
            <ManualTuner
              onBeforeStart={onTunerBeforeStart}
              externalSessionActive={externalSessionActive}
            />
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
