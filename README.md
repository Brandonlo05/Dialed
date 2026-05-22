# Dialed

Premium focus entrainment app — binaural audio parallel to Spotify, watch biometrics, harmonic key matching.

## Sources of truth

Place these at the repo root (required for agents and contributors):

- `DIALED_ARCHITECTURE_SPEC.md`
- `SYSTEM_PROMPT.md`

Cursor loads them via [`.cursor/rules/dialed.mdc`](.cursor/rules/dialed.mdc) and [AGENTS.md](AGENTS.md).

## Setup

Use a path **without spaces** (e.g. `/Users/BLO/DialedApp`).

```bash
source scripts/env.sh
npm install --legacy-peer-deps
npm start
```

## Native development build

```bash
source scripts/env.sh
npx expo prebuild
npx expo run:ios
# or EAS:
npx eas-cli build --profile development-device --platform ios
```

## Phases

| Phase | Status |
|-------|--------|
| 0 Foundation | Expo, NativeWind, EAS, spec links |
| 1 UI | Dashboard, stats, navigation |
| 2 Audio | `modules/dialed-audio` Swift engine |
| 3 watchOS | Scaffold + ring buffer |
| 4 Harmonic | `harmonicMatcher.ts` |
| 5 Hardening | Cooldown FSM, privacy manifest template |

## Remote

```bash
git remote add origin https://github.com/Brandonlo05/Dialed.git
```
