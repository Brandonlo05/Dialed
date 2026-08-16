/**
 * TAB 4 · TUNER — freeform 1–100 Hz synthesizer.
 *
 * The escape hatch for users who want to drive the engine directly instead of
 * choosing a curated protocol. ManualTuner owns the engine while it is live,
 * so it is handed `onBeforeStart` to wind down any protocol session first —
 * two sources must never contend for the DSP.
 *
 * ── ON THE SVF FILTER CONTROLS ─────────────────────────────────────────────
 * The brief asks for live state-variable-filter controls here. The Simper SVF
 * exists in the engine, but its coefficients are not exposed across the Expo
 * bridge — there is no JS setter to call. Adding one means editing
 * AudioEngineManager.swift, which this sprint's guardrail explicitly forbids.
 * So the control is not stubbed with a slider that does nothing; it is left
 * out until the setter can be added in a sprint that is allowed to touch the
 * audio module.
 */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ManualTuner } from '../../src/components/controls/ManualTuner';
import { VolumeSlider } from '../../src/components/controls/VolumeSlider';
import { SURFACE } from '../../src/constants/theme';
import { useAudioEngine } from '../../src/hooks/useAudioEngine';
import { useSession } from '../../src/services/sessionStore';

export default function TunerScreen() {
  const { stop } = useAudioEngine();
  const isPlaying = useSession((s) => s.isPlaying);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 18 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 14, marginBottom: 18 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.38)', fontSize: 10.5, fontWeight: '700',
              letterSpacing: 4, textTransform: 'uppercase',
            }}
          >
            Freeform Synthesis
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 2 }}>
            Tuner
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 19, marginTop: 7 }}>
            Drive the engine directly. The breath pattern follows the band you
            tune into.
          </Text>
        </View>

        <ManualTuner
          onBeforeStart={async () => { if (isPlaying) await stop(); }}
          externalSessionActive={isPlaying}
        />

        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.32)', fontSize: 9.5, fontWeight: '800',
              letterSpacing: 3, textTransform: 'uppercase', marginBottom: 9,
            }}
          >
            Calibrated Entrainment Gain
          </Text>
          <VolumeSlider />
        </View>

        <View
          style={{
            marginTop: 22, borderRadius: 16, padding: 14,
            backgroundColor: SURFACE.glass,
            borderWidth: 1, borderColor: SURFACE.hairline,
          }}
        >
          <Text
            style={{
              color: 'rgba(255,255,255,0.34)', fontSize: 9.5, fontWeight: '800',
              letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 7,
            }}
          >
            Band Reference
          </Text>
          {[
            ['1–4 Hz',   'Delta',  'Deep restorative'],
            ['4–7.5 Hz', 'Theta',  'Plasticity, visualization'],
            ['8–12 Hz',  'Alpha',  'Calm vigilance'],
            ['12–15 Hz', 'SMR',    'Sensory stillness'],
            ['15–30 Hz', 'Beta',   'Analytical processing'],
            ['30+ Hz',   'Gamma',  'High alertness'],
          ].map(([range, name, desc]) => (
            <View
              key={name}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
            >
              <Text
                style={{
                  color: 'rgba(255,255,255,0.5)', fontSize: 10.5,
                  fontFamily: 'Menlo', width: 74,
                }}
              >
                {range}
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', width: 56 }}>
                {name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.34)', fontSize: 11.5, flex: 1 }}>
                {desc}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
