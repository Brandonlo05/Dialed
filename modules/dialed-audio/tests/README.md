# dialed-audio verification harnesses

Offline verification of the native DSP. Each `.js` harness is a **bit-faithful
replica** of the corresponding Swift math in `../ios/AudioEngineManager.swift`
(same float64 phase accumulators, same coefficients, same wrap points), so a
regression in the Swift shows up here as a failed assertion — without needing
a device, a simulator, or an audio interface.

Run them all:

```bash
npm run test:dsp
```

| File | Verifies |
|---|---|
| `test-432.js` | Golden Frequency: peak spectral density at 432.0 ± 0.1 Hz (Goertzel + parabolic interpolation), Pythagorean partials at 108/216/864 Hz, −31.7667 cents vs A440, no clipping |
| `test-svf.js` | Simper SVF low-shelf: exact bit-identical passthrough at 0 dB, +12 dB shelf response, stability under sustained drive; xorshift32 PRNG distribution; 432 Hz regression |
| `test-gym.js` | Training Mode: legacy glide bypass, Phase I linear 18→40 Hz landing at 120 s without overshoot, Phase III exponential 10→4 Hz settling, isochronic gate range/slew/duty (click-free) |
| `Frequency432Tests.swift` | The same 432 Hz assertion as an XCTest using Accelerate/vDSP FFT. **Not currently wired to a target** — the generated Xcode project has no test target, and this file sits outside the podspec source glob so it never compiles into the app. Add a unit-test target in Xcode to run it. |

## What these do *not* cover

These verify **signal math**, not **timing**. Real-time safety claims
(worst-case render-block duration, absence of priority inversion on
`com.apple.audio.IOThread`) can only be validated with Xcode Instruments
Audio System Trace on physical hardware. See the profiling protocol in the
project notes.
