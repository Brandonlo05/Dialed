import CoreHaptics
import Foundation

/// Eyes-closed somatic breath pacing.
///
/// Each respiratory stage gets a distinct tactile signature so the cycle can
/// be followed by touch alone, with the phone face-down or in a pocket:
///
///   inhale  — continuous event whose intensity RISES over the stage
///   hold    — low-rate micro-pulse train (a "held" texture, not silence)
///   exhale  — continuous event whose intensity FALLS over the stage
///   rest    — deliberate silence, so the floor of the cycle is unmistakable
///
/// Patterns are built per stage with an explicit duration, so a 4-2-8-2 cycle
/// produces a 4 s rise, a 2 s pulse train, an 8 s fall and 2 s of nothing —
/// the tactile shape matches the visual ring and the audio swell exactly.
///
/// Everything here runs on the caller's (main) thread. CHHapticEngine has its
/// own internal servicing; nothing in this file is reachable from the audio
/// render thread.
final class BreathHaptics {
  static let shared = BreathHaptics()

  private var engine: CHHapticEngine?
  private var player: CHHapticPatternPlayer?
  private var started = false

  /// False on devices without a Taptic Engine (iPad, older hardware) and in
  /// the simulator. Every entry point no-ops rather than throwing.
  private(set) var isSupported = CHHapticEngine.capabilitiesForHardware().supportsHaptics

  private init() {}

  // MARK: – Lifecycle

  func start() {
    guard isSupported, !started else { return }
    do {
      let e = try CHHapticEngine()
      // The system stops the engine on interruption/background. Without these
      // handlers the pacer would silently die mid-session and never recover.
      e.stoppedHandler = { [weak self] _ in
        self?.started = false
      }
      e.resetHandler = { [weak self] in
        guard let self, let engine = self.engine else { return }
        do {
          try engine.start()
          self.started = true
        } catch {
          self.started = false
        }
      }
      // Keep the engine warm between stages — restarting per stage would add
      // tens of milliseconds of latency and smear the cue off the beat.
      e.playsHapticsOnly = true
      e.isAutoShutdownEnabled = false
      try e.start()
      engine = e
      started = true
    } catch {
      engine = nil
      started = false
    }
  }

  func stop() {
    guard isSupported else { return }
    try? player?.stop(atTime: CHHapticTimeImmediate)
    player = nil
    engine?.stop()
    started = false
  }

  // MARK: – Stage playback

  /// Play one respiratory stage.
  /// - Parameters:
  ///   - stage: 0 inhale · 1 hold · 2 exhale · 3 rest
  ///   - duration: stage length in seconds
  ///   - sharpness: 0–1 tactile "brightness"; callers derive this from the
  ///     active carrier so higher carriers feel crisper. NOTE: this is a
  ///     mapping, not a frequency — the Taptic Engine cannot be driven at an
  ///     audio carrier rate, so a 200–400 Hz carrier is expressed as texture.
  func playStage(_ stage: Int, duration: Double, sharpness: Float) {
    guard isSupported else { return }
    if !started { start() }
    guard let engine, started else { return }

    try? player?.stop(atTime: CHHapticTimeImmediate)
    player = nil

    let dur = max(0.05, min(30.0, duration))
    let sharp = max(0.0, min(1.0, sharpness))

    var events: [CHHapticEvent] = []
    var curves: [CHHapticParameterCurve] = []

    switch stage {
    case 0: // ── Inhale: building rise ──
      events.append(CHHapticEvent(
        eventType: .hapticContinuous,
        parameters: [
          CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.06),
          CHHapticEventParameter(parameterID: .hapticSharpness, value: sharp * 0.5),
        ],
        relativeTime: 0,
        duration: dur
      ))
      curves.append(CHHapticParameterCurve(
        parameterID: .hapticIntensityControl,
        controlPoints: [
          .init(relativeTime: 0, value: 0.06),
          .init(relativeTime: dur * 0.6, value: 0.45),
          .init(relativeTime: dur, value: 0.85),
        ],
        relativeTime: 0
      ))

    case 1: // ── Hold: low-rate micro-pulse train ──
      // ~6 Hz is the ceiling at which discrete taps still read as separate
      // pulses rather than blurring into a buzz.
      let rate = 6.0
      let count = max(1, Int(dur * rate))
      for i in 0..<count {
        events.append(CHHapticEvent(
          eventType: .hapticTransient,
          parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.28),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2 + sharp * 0.5),
          ],
          relativeTime: Double(i) / rate
        ))
      }

    case 2: // ── Exhale: smooth decaying fall ──
      events.append(CHHapticEvent(
        eventType: .hapticContinuous,
        parameters: [
          CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7),
          CHHapticEventParameter(parameterID: .hapticSharpness, value: sharp * 0.32),
        ],
        relativeTime: 0,
        duration: dur
      ))
      curves.append(CHHapticParameterCurve(
        parameterID: .hapticIntensityControl,
        controlPoints: [
          .init(relativeTime: 0, value: 0.7),
          .init(relativeTime: dur * 0.55, value: 0.3),
          .init(relativeTime: dur, value: 0.02),
        ],
        relativeTime: 0
      ))

    default: // ── Rest: silence is the cue ──
      return
    }

    do {
      let pattern = try CHHapticPattern(events: events, parameterCurves: curves)
      let p = try engine.makePlayer(with: pattern)
      try p.start(atTime: CHHapticTimeImmediate)
      player = p
    } catch {
      player = nil
    }
  }
}
