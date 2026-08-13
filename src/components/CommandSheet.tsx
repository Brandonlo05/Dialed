/**
 * Interactive Bottom-Sheet Command Center.
 *
 * Tapping a program card no longer blind-starts audio — it glides this sheet
 * up over pure black with the program's live trajectory canvas, target-lock
 * ticker, psychology copy framework, and the ENGAGE COGNITIVE OVERRIDE CTA
 * that actually fires the native engine.
 *
 * Slide/fade animations are driven by Reanimated shared values (UI thread);
 * the sheet lives in a transparent Modal so it overlays the tab bar.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { breathForProgram } from '../constants/breathwork';
import { PRESET_UX_DATA, type ProgramId } from '../constants/presetUx';
import { NEON } from '../constants/theme';
import { TrajectoryGraph } from './neuro-visualizers/TrajectoryGraph';

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H = Math.min(SCREEN_H * 0.92, 780);

export type SheetProgram = {
  id: ProgramId;
  title: string;
  subtitle: string;
  icon: string;
  beatHz: number;
};

type CommandSheetProps = {
  program: SheetProgram | null;
  onEngage: () => void;
  onClose: () => void;
};

// ── Target-lock ticker ───────────────────────────────────────────────────────

function useTargetLockTicker(programId: ProgramId | null, targetHz: number) {
  const [hz, setHz] = useState(targetHz);
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!programId) return;
    let current = targetHz * 2.4 + 3; // acquisition starts high, converges down
    setLocked(false);
    setHz(current);
    timer.current = setInterval(() => {
      current = targetHz + (current - targetHz) * 0.8;
      if (Math.abs(current - targetHz) < 0.05) {
        current = targetHz;
        setLocked(true);
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
      }
      setHz(current);
    }, 90);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [programId, targetHz]);

  return { hz, locked };
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return (
    <Text
      className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-[3px]"
      style={{ color }}
    >
      {text}
    </Text>
  );
}

// ── Sheet ────────────────────────────────────────────────────────────────────

export function CommandSheet({ program, onEngage, onClose }: CommandSheetProps) {
  const ty = useSharedValue(SHEET_H);
  const backdrop = useSharedValue(0);

  const ux = program ? PRESET_UX_DATA[program.id] : null;
  const { hz, locked } = useTargetLockTicker(program?.id ?? null, ux?.targetHz ?? 10);

  // Glide in whenever a program opens the sheet
  useEffect(() => {
    if (program) {
      ty.value = SHEET_H;
      backdrop.value = 0;
      ty.value = withSpring(0, { damping: 21, stiffness: 170 });
      backdrop.value = withTiming(1, { duration: 240 });
    }
  }, [program?.id, program, ty, backdrop]);

  function dismiss(after: () => void) {
    backdrop.value = withTiming(0, { duration: 220 });
    ty.value = withTiming(SHEET_H, { duration: 260 }, (finished) => {
      if (finished) runOnJS(after)();
    });
  }

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  if (!program || !ux) return null;

  return (
    <Modal transparent visible statusBarTranslucent onRequestClose={() => dismiss(onClose)}>
      {/* Backdrop */}
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)' }, backdropStyle]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => dismiss(onClose)} />
      </Animated.View>

      {/* Sheet */}
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
            borderColor: `${ux.glow}45`,
            shadowColor: ux.glow,
            shadowOpacity: 0.5,
            shadowRadius: 44,
            shadowOffset: { width: 0, height: -8 },
            elevation: 30,
            overflow: 'hidden',
          },
          sheetStyle,
        ]}
      >
        {/* Grabber */}
        <View className="items-center pb-1 pt-3">
          <View className="h-1 w-10 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mb-4 mt-2 flex-row items-center" style={{ gap: 12 }}>
            <View
              className="h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: `${ux.glow}18`,
                borderWidth: 1,
                borderColor: `${ux.glow}45`,
              }}
            >
              <Text allowFontScaling={false} style={{ fontSize: 19 }}>{program.icon}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[22px] font-black tracking-tight text-dialed-stat">
                {program.title}
              </Text>
              <Text className="mt-0.5 text-[11px] text-dialed-muted">{program.subtitle}</Text>
            </View>
            <Pressable onPress={() => dismiss(onClose)} hitSlop={12}>
              <Text style={{ color: NEON.muted, fontSize: 17 }}>✕</Text>
            </Pressable>
          </View>

          {/* TOP CANVAS — live trajectory */}
          <View
            className="overflow-hidden rounded-2xl"
            style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)' }}
          >
            <TrajectoryGraph
              variant={ux.visualizer}
              colorA={ux.themeFrom}
              colorB={ux.themeTo === '#0B0C10' || ux.themeTo === '#121212' ? ux.glow : ux.themeTo}
              beatHz={program.beatHz}
            />
          </View>

          {/* LIVE READOUT — target-lock ticker */}
          <View
            className="mt-3 flex-row items-center justify-between rounded-xl px-4 py-3"
            style={{
              backgroundColor: `${ux.glow}0E`,
              borderWidth: 1,
              borderColor: locked ? `${ux.glow}55` : 'rgba(255,255,255,0.08)',
            }}
          >
            <Text
              className="font-mono text-[11px] font-bold tracking-[1px]"
              style={{ color: locked ? ux.glow : NEON.muted }}
            >
              {locked ? '● TARGET LOCK' : '◌ ACQUIRING'}
            </Text>
            <Text
              className="font-mono text-[15px] font-bold"
              style={{ color: ux.glow, fontVariant: ['tabular-nums'] }}
            >
              {hz.toFixed(1)} Hz
              {program.id === 'burnout' ? '  →  2.0 Hz' : ''}
            </Text>
          </View>

          {/* BREATH PAIRING — the pattern this program is designed around */}
          <SectionLabel text="Breathe With It" color={ux.glow} />
          <View
            className="rounded-2xl px-4 py-3.5"
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderWidth: 1,
              borderColor: '#1A1A1E',
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-[13px] font-bold text-dialed-stat">
                {breathForProgram(program.id).name}
              </Text>
              <Text
                className="font-mono text-[10px]"
                style={{ color: ux.glow, fontVariant: ['tabular-nums'] }}
              >
                {breathForProgram(program.id)
                  .cycle.filter((n) => n > 0)
                  .join(' · ')}
              </Text>
            </View>
            <Text className="mt-1 text-[12px] leading-[18px] text-dialed-muted">
              {breathForProgram(program.id).summary}
            </Text>
          </View>

          {/* SECTION 1 — THE CHALLENGE */}
          <SectionLabel text="The Challenge" color={NEON.muted} />
          <Text className="text-[13.5px] leading-[21px]" style={{ color: '#9d99ad' }}>
            {ux.challenge}
          </Text>

          {/* SECTION 2 — THE NEURAL INTERVENTION */}
          <SectionLabel text="The Neural Intervention" color={ux.glow} />
          <Text className="text-[13.5px] leading-[21px] text-dialed-stat">
            {ux.science}
          </Text>

          {/* SECTION 3 — THE AFTER-STATE */}
          <SectionLabel text="The After-State" color={ux.glow} />
          <View
            className="rounded-2xl px-4 py-4"
            style={{
              backgroundColor: `${ux.glow}12`,
              borderWidth: 1,
              borderColor: `${ux.glow}40`,
              shadowColor: ux.glow,
              shadowOpacity: 0.35,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text className="text-[13.5px] leading-[21px]" style={{ color: '#e8e6f3' }}>
              {ux.afterState}
            </Text>
          </View>
        </ScrollView>

        {/* CONTROL — massive glowing CTA pinned to the sheet bottom */}
        <View className="absolute bottom-0 left-0 right-0 px-6 pb-9 pt-3" style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}>
          <Pressable onPress={() => dismiss(onEngage)}>
            <View
              className="overflow-hidden rounded-2xl"
              style={{
                borderWidth: 1.5,
                borderColor: `${ux.glow}70`,
                shadowColor: ux.glow,
                shadowOpacity: 0.65,
                shadowRadius: 26,
                shadowOffset: { width: 0, height: 0 },
                elevation: 18,
              }}
            >
              <LinearGradient
                colors={[`${ux.themeFrom}30`, `${ux.glow}1A`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="items-center py-[18px]"
              >
                <Text
                  className="text-[15px] font-black uppercase tracking-[3px]"
                  style={{ color: ux.glow }}
                >
                  Engage Cognitive Override
                </Text>
              </LinearGradient>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}
