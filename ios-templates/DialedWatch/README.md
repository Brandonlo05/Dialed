# Dialed watchOS companion (Phase 3)

After `npx expo prebuild`, add a watchOS target in Xcode:

1. File → New → Target → watchOS App
2. Enable HealthKit capability on both iOS and watch targets
3. Implement `HKWorkoutSession` in the watch extension to keep heart-rate sensors active
4. Stream RR-interval batches via `WCSession.sendMessageData`

iOS host receives packets in a native module and forwards to `src/services/watchBridge.ts`.
