# Dialed — agent instructions

## Sources of truth

Always read before implementing:

- [DIALED_ARCHITECTURE_SPEC.md](./DIALED_ARCHITECTURE_SPEC.md)
- [SYSTEM_PROMPT.md](./SYSTEM_PROMPT.md)

## Stack

- Expo SDK 54, TypeScript, NativeWind v4 (dark-first UI)
- Custom dev client + EAS (`eas.json`) for native Swift modules
- Native audio: `modules/dialed-audio` (iOS `AVAudioEngine`)
- watchOS companion: `ios/DialedWatch` (scaffold)
- Harmonic matcher: `src/services/harmonicMatcher.ts`

## Commands

```bash
npm start          # Expo dev server
npm run ios        # iOS simulator (dev client after prebuild)
npx expo prebuild  # Generate ios/ android/ for native work
```
