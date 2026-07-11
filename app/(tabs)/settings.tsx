import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NEON } from '../../src/constants/theme';
import { setBrownNoiseEnabled } from '../../src/services/audioEngine';
import { tapSelect } from '../../src/services/haptics';
import {
  COGNITIVE_LABELS,
  ENVIRONMENT_LABELS,
  GOAL_LABELS,
  getCachedProfile,
} from '../../src/services/userProfile';

// ── Reusable toggle row ───────────────────────────────────────────────────────

function SettingRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl"
      style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.025)']}
        className="px-4 py-4"
      >
        <View className="flex-row items-center">
          <View className="flex-1 pr-4">
            <Text className="font-semibold text-dialed-stat">{title}</Text>
            <Text className="mt-0.5 text-xs leading-[18px] text-dialed-muted">{description}</Text>
          </View>
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#7c5cff' }}
            thumbColor={value ? '#e8e6f3' : '#4a4558'}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const profile = getCachedProfile();
  const [brownNoise, setBrownNoise] = useState(true);
  const [watchSync,  setWatchSync]  = useState(false);

  // Brown-noise toggle drives the live engine (no-op when no session running)
  function toggleBrownNoise(v: boolean) {
    tapSelect();
    setBrownNoise(v);
    void setBrownNoiseEnabled(v);
  }

  return (
    <SafeAreaView className="flex-1 bg-dialed-bg" edges={['top']}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <View className="mb-7 mt-4">
          <Text className="text-[11px] font-semibold uppercase tracking-[4px] text-dialed-muted">
            Configuration
          </Text>
          <Text className="mt-0.5 text-[28px] font-black tracking-tight text-dialed-stat">
            Settings
          </Text>
        </View>

        {/* ── Cognitive calibration ─────────────────────────────────────────── */}
        <Text className="mb-2 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Cognitive Calibration
        </Text>

        <View
          className="mb-3 overflow-hidden rounded-2xl"
          style={{ borderWidth: 1, borderColor: `${NEON.violet}35` }}
        >
          <LinearGradient
            colors={[`${NEON.violet}12`, 'rgba(5,5,8,0.97)']}
            className="p-4"
          >
            {profile ? (
              <View style={{ gap: 8 }}>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-dialed-muted">Brain profile</Text>
                  <Text className="text-xs font-semibold text-dialed-stat">
                    {COGNITIVE_LABELS[profile.cognitive]}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-dialed-muted">Environment</Text>
                  <Text className="text-xs font-semibold text-dialed-stat">
                    {ENVIRONMENT_LABELS[profile.environment]}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-dialed-muted">Objective</Text>
                  <Text className="text-xs font-semibold text-dialed-stat">
                    {GOAL_LABELS[profile.goal]}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-xs text-dialed-muted">No calibration profile yet.</Text>
            )}

            <Pressable
              onPress={() => router.push('/onboarding')}
              className="mt-4 items-center rounded-xl py-2.5"
              style={{
                backgroundColor: `${NEON.violet}1F`,
                borderWidth: 1,
                borderColor: `${NEON.violet}55`,
              }}
            >
              <Text className="text-xs font-bold uppercase tracking-[1.5px]" style={{ color: NEON.violetSoft }}>
                Recalibrate Engine
              </Text>
            </Pressable>
          </LinearGradient>
        </View>

        {/* ── Audio Engine ─────────────────────────────────────────────────── */}
        <Text className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
          Audio Engine
        </Text>
        <SettingRow
          title="ADHD Brownian Noise"
          description="Broadband noise layer underneath binaural tones — applies live to the running engine"
          value={brownNoise}
          onChange={toggleBrownNoise}
        />
        <SettingRow
          title="Apple Watch Sync"
          description="Adaptive mode switching based on HRV and biometric data (coming online)"
          value={watchSync}
          onChange={(v) => { tapSelect(); setWatchSync(v); }}
        />

        {/* ── Closed-loop note ─────────────────────────────────────────────── */}
        <View
          className="mt-6 overflow-hidden rounded-2xl"
          style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.015)']}
            className="p-4"
          >
            <Text className="mb-1.5 text-[10px] font-bold uppercase tracking-[2px] text-dialed-muted">
              Closed-Loop Audio
            </Text>
            <Text className="text-xs leading-[18px] text-dialed-muted">
              Dialed runs entirely on its own proprietary oscillators — binaural carriers and
              Brownian noise are synthesized natively on-device. Parallel audio stays active:
              entrainment mixes underneath anything else you play, without ducking.
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
