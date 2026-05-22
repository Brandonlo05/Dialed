# Dialed — System Prompt (AI & engineering)

You are building **Dialed**, a premium iOS focus-entrainment application. Follow this document and `DIALED_ARCHITECTURE_SPEC.md` as authoritative sources of truth.

---

## Identity & tone

- Product voice: calm, precise, high-performance — never clinical or hype-driven
- UI: ultra-premium **dark mode**, glassmorphism cards, high-contrast stat typography
- Copy examples: "92% Less Jitters", "Zero Chemical Crash", "Parallel Audio"

---

## Non-negotiable technical rules

### Audio

1. **Always** use `AVAudioSession` category `.playback` with option `.mixWithOthers`.
2. Never duck, interrupt, or take exclusive ownership of the audio session — Spotify must keep playing.
3. Binaural output must be **true stereo**: L = carrier, R = carrier + beat (see `AudioEngineManager`).
4. Use gain ramps (~12ms) on start/stop — no audible clicks.
5. Native audio changes go in `modules/dialed-audio/ios/`; expose via Expo Module, not raw RN bridge unless necessary.

### Spotify / music

1. Use Spotify **Web API** with user OAuth token — not deprecated native metadata endpoints for key detection.
2. Poll currently-playing every **2s**; debounce track changes **1s**.
3. Recalibrate carrier within **3 seconds** of a stable track change using audio-features `key` + `mode`.
4. Clamp recalibrated carrier to **80–480 Hz**.

### watchOS

1. Keep sensors alive via `HKWorkoutSession` on watch.
2. Stream `BiometricPacket` JSON over `WatchConnectivity`.
3. iOS side uses ring buffer for dropped packets — never block UI on watch reachability.

### React Native / Expo

1. Expo SDK **54**, TypeScript strict, NativeWind v4 (`className` on RN components).
2. Navigation via **Expo Router** under `app/`.
3. Custom native code requires **expo-dev-client** + `npx expo prebuild` — Expo Go is insufficient for audio/watch modules.

---

## Four focus modes

When adding features, respect existing mode IDs and frequencies:

| ID | Title | beatHz | carrierHz |
|----|-------|--------|-----------|
| `standard-focus` | Standard Focus | 10 | 220 |
| `deep-lockdown` | Deep Lockdown | 40 | 200 |
| `caffeine-rush` | Caffeine Rush | 20 | 240 |
| `clutch-mode` | Clutch Mode | 7 | 180 |

Brown noise defaults **on** for `standard-focus` only.

---

## File ownership map

| Concern | Location |
|---------|----------|
| Dashboard UI | `app/(tabs)/index.tsx` |
| Mode constants | `src/constants/modes.ts` |
| Audio JS API | `src/services/audioEngine.ts` |
| Swift engine | `modules/dialed-audio/ios/AudioEngineManager.swift` |
| Spotify poll | `src/services/musicPoller.ts` |
| Key → Hz math | `src/services/harmonicMatcher.ts` |
| OAuth | `src/services/spotifyAuth.ts`, `spotifyClient.ts` |
| Watch JS buffer | `src/services/watchBridge.ts` |
| Watch native | `modules/dialed-watch/ios/` |
| Cooldown FSM | `src/services/cognitiveCooldown.ts` |
| Agent rules | `.cursor/rules/dialed.mdc`, `AGENTS.md` |

---

## What not to do

- Do not switch to `.soloAmbient` or remove `.mixWithOthers`
- Do not merge binaural L/R into mono
- Do not add heavy dependencies for UI polish already covered by `expo-blur` + `expo-linear-gradient`
- Do not commit `.env` or API secrets
- Do not rewrite specs without explicit user request — update both spec files when architecture changes

---

## Testing expectations

| Test | Pass criteria |
|------|----------------|
| Parallel audio | Binaural plays with Spotify; no ducking |
| Track change | Carrier updates <3s after song change (with token) |
| Interruption | Phone call → pause → resume restores engine |
| Simulator | Dashboard renders; native audio requires dev build |
| Device | `npx expo run:ios` with valid signing team |

---

## Git & checkpoints

Remote: `https://github.com/Brandonlo05/Dialed.git`

Commit messages: complete sentences, phase-oriented (`feat: complete Phase N …`).

---

## When uncertain

1. Re-read `DIALED_ARCHITECTURE_SPEC.md`
2. Inspect the Swift module before changing audio behavior
3. Prefer minimal diffs that match existing naming and patterns
