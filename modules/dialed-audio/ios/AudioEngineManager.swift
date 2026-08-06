import AVFoundation
import Foundation

enum AudioEngineError: Error {
  case formatUnavailable
}

/// True-stereo synthesis engine with independent per-channel modulation:
///
/// 1. Binaural (default): left = carrierHz, right = carrierHz + beatHz.
/// 2. Per-channel AM: each channel can carry its own raised-cosine amplitude
///    envelope (rate + depth), fully independent of the other. This covers:
///      - Asymmetric Left-Ear SMR (left AM 12–15 Hz, right clean)
///      - Bilateral isochronic pulses (both channels AM at e.g. 40 Hz)
///      - Dual-band asymmetry (left 13 Hz SMR, right 10 Hz alpha)
///    beatHz is bypassed whenever any AM envelope is active.
/// 3. Noise layer: Brownian (default) or pink (Paul Kellett 3-pole filter).
///
/// AVAudioSession category .mixWithOthers keeps all other app audio uninterrupted.
final class AudioEngineManager {
  static let shared = AudioEngineManager()

  // MARK: – Engine (main-thread only)
  private let engine = AVAudioEngine()
  private var binauralNode: AVAudioSourceNode?
  private var brownNode: AVAudioSourceNode?
  private var isRunning   = false
  private var isFadingOut = false

  // MARK: – Lock-protected parameters (read by audio render callback)
  private struct RenderParams {
    var carrierHz:    Double = 200
    var beatHz:       Double = 10
    var volume:       Float  = 0.25   // direct amplitude, 0–1 range
    var brownEnabled: Bool   = false  // noise layer on/off
    var pinkNoise:    Bool   = false  // false = Brownian, true = pink
    var targetGain:   Float  = 1      // 0 = fade out, 1 = fade in
    // Pythagorean overtone stack (carrier/4, carrier/2, carrier×2).
    // 0 disables the entire path — existing output stays bit-identical.
    var overtoneGain: Float  = 0
    // Independent per-channel AM envelopes (depth 0 = channel unmodulated)
    var amLeftHz:     Double = 0
    var amLeftDepth:  Float  = 0
    var amRightHz:    Double = 0
    var amRightDepth: Float  = 0
  }
  private var params     = RenderParams()
  private var paramsLock = os_unfair_lock()

  // MARK: – Render-thread-exclusive state (never touched from other threads)
  private var phaseL:     Double = 0
  private var phaseR:     Double = 0
  private var amPhaseL:   Double = 0
  private var amPhaseR:   Double = 0
  private var otPhaseHalf:   Double = 0  // carrier / 2 (216 Hz on a 432 carrier)
  private var otPhaseQuart:  Double = 0  // carrier / 4 (108 Hz)
  private var otPhaseOctave: Double = 0  // carrier × 2 (864 Hz)
  private var brownState: Double = 0
  // Pink noise filter poles (Paul Kellett economy approximation)
  private var pinkB0:     Double = 0
  private var pinkB1:     Double = 0
  private var pinkB2:     Double = 0
  private var currentGain: Float = 0

  // MARK: – Init / deinit

  private init() {
    let nc = NotificationCenter.default
    nc.addObserver(self, selector: #selector(handleInterruption(_:)),
                   name: AVAudioSession.interruptionNotification, object: nil)
    nc.addObserver(self, selector: #selector(handleRouteChange(_:)),
                   name: AVAudioSession.routeChangeNotification,  object: nil)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  // MARK: – Public API

  func start(
    carrierHz: Double,
    beatHz: Double,
    brownNoise: Bool,
    pinkNoise: Bool = false,
    amLeftHz: Double = 0,
    amLeftDepth: Float = 0,
    amRightHz: Double = 0,
    amRightDepth: Float = 0,
    overtoneGain: Float = 0
  ) throws {
    withParams {
      $0.carrierHz    = carrierHz
      $0.beatHz       = beatHz
      $0.brownEnabled = brownNoise
      $0.pinkNoise    = pinkNoise
      $0.targetGain   = 1
      $0.amLeftHz     = Self.clampAmHz(amLeftHz)
      $0.amLeftDepth  = max(0, min(1, amLeftDepth))
      $0.amRightHz    = Self.clampAmHz(amRightHz)
      $0.amRightDepth = max(0, min(1, amRightDepth))
      $0.overtoneGain = max(0, min(1, overtoneGain))
    }

    // Tear down any active or fading session before rebuilding
    if isRunning || isFadingOut { immediatelySilence() }

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
    try session.setActive(true)

    // Reset render-thread state; render callbacks haven't started yet
    currentGain = 0
    phaseL      = 0
    phaseR      = 0
    amPhaseL    = 0
    amPhaseR    = 0
    otPhaseHalf   = 0
    otPhaseQuart  = 0
    otPhaseOctave = 0
    brownState  = 0
    pinkB0      = 0
    pinkB1      = 0
    pinkB2      = 0

    try buildGraph()
    try engine.start()
    isRunning   = true
    isFadingOut = false
  }

  func stop() {
    guard isRunning, !isFadingOut else { return }
    withParams { $0.targetGain = 0 }
    isFadingOut = true
    // Allow ~20ms for the 12ms gain ramp + one buffer of headroom
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) { [weak self] in
      self?.immediatelySilence()
    }
  }

  func setCarrierFrequency(_ hz: Double)       { withParams { $0.carrierHz    = hz   } }
  func setBeatFrequency(_ hz: Double)          { withParams { $0.beatHz       = hz   } }
  func setVolume(_ level: Float)               { withParams { $0.volume       = max(0, min(1, level)) } }
  func setBrownNoiseEnabled(_ enabled: Bool)   { withParams { $0.brownEnabled = enabled } }

  /// Set both per-channel AM envelopes live. Depth 0 disables a channel's
  /// modulation. The render callback picks changes up on its next buffer;
  /// the raised-cosine envelope keeps transitions click-free.
  func setChannelModulation(leftHz: Double, leftDepth: Float, rightHz: Double, rightDepth: Float) {
    withParams {
      $0.amLeftHz     = Self.clampAmHz(leftHz)
      $0.amLeftDepth  = max(0, min(1, leftDepth))
      $0.amRightHz    = Self.clampAmHz(rightHz)
      $0.amRightDepth = max(0, min(1, rightDepth))
    }
  }

  /// Legacy Left-Ear SMR toggle — thin wrapper over setChannelModulation,
  /// clamped to the SMR band. Kept for the calibration path and Neuro-Labs.
  func setAsymmetricSMR(enabled: Bool, smrHz: Double, depth: Float) {
    let rate = max(8, min(20, smrHz))
    setChannelModulation(
      leftHz: enabled ? rate : 0,
      leftDepth: enabled ? depth : 0,
      rightHz: 0,
      rightDepth: 0
    )
  }

  /// Switch the noise layer color live (false = Brownian, true = pink).
  func setNoiseColor(pink: Bool) {
    withParams { $0.pinkNoise = pink }
  }

  /// Pythagorean overtone stack level (0 = off, bit-identical legacy path).
  func setOvertoneGain(_ gain: Float) {
    withParams { $0.overtoneGain = max(0, min(1, gain)) }
  }

  /// AM rates up to low-gamma (45 Hz) are allowed for isochronic/ASSR work;
  /// anything faster is a synthesis artifact, not entrainment.
  private static func clampAmHz(_ hz: Double) -> Double {
    return max(0, min(45, hz))
  }

  // MARK: – Private

  private func immediatelySilence() {
    // engine.stop() is synchronous — render callbacks are guaranteed done on return
    engine.stop()
    engine.reset()
    binauralNode = nil
    brownNode    = nil
    isRunning    = false
    isFadingOut  = false
    currentGain  = 0
  }

  private func buildGraph() throws {
    let outputRate = engine.outputNode.outputFormat(forBus: 0).sampleRate
    let sampleRate = outputRate > 0 ? outputRate : 44_100.0

    guard let stereo = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2) else {
      throw AudioEngineError.formatUnavailable
    }

    let binaural = makeBinauralNode(format: stereo, sampleRate: sampleRate)
    let brown    = makeBrownNode(format: stereo)

    engine.attach(binaural)
    engine.attach(brown)
    engine.connect(binaural, to: engine.mainMixerNode, format: stereo)
    engine.connect(brown,    to: engine.mainMixerNode, format: stereo)

    binauralNode = binaural
    brownNode    = brown
  }

  // MARK: – Node factories

  private func makeBinauralNode(format: AVAudioFormat, sampleRate: Double) -> AVAudioSourceNode {
    // Precompute constants captured once per session
    let twoPi    = 2.0 * Double.pi
    let rampStep = Float(1.0 / (0.012 * sampleRate))   // 12 ms ramp

    return AVAudioSourceNode(format: format) { [weak self] _, _, frameCount, audioBufferList in
      guard let self else { return noErr }

      os_unfair_lock_lock(&self.paramsLock)
      let p = self.params
      os_unfair_lock_unlock(&self.paramsLock)

      let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
      guard abl.count >= 2,
            let leftPtr  = abl[0].mData?.assumingMemoryBound(to: Float.self),
            let rightPtr = abl[1].mData?.assumingMemoryBound(to: Float.self)
      else { return noErr }

      // Any active AM envelope bypasses the binaural beat offset — modulated
      // channels carry their entrainment in the envelope, not the beat.
      let amActive  = p.amLeftDepth > 0 || p.amRightDepth > 0
      let phaseIncL = p.carrierHz * twoPi / sampleRate
      let phaseIncR = (p.carrierHz + (amActive ? 0 : p.beatHz)) * twoPi / sampleRate
      let amIncL    = p.amLeftHz  * twoPi / sampleRate
      let amIncR    = p.amRightHz * twoPi / sampleRate
      let target    = p.targetGain

      // Pythagorean overtone stack (Golden Frequency): partials at f/2, f/4,
      // and 2f with fixed natural-tuning weights. Precomputed per callback —
      // zero allocations, no locks, no per-sample division. otNorm manages
      // crest factor so carrier + stack can never clip at full volume.
      let otGain  = p.overtoneGain
      let otInc2  = (p.carrierHz / 2) * twoPi / sampleRate
      let otInc4  = (p.carrierHz / 4) * twoPi / sampleRate
      let otIncO  = (p.carrierHz * 2) * twoPi / sampleRate
      let otNorm: Float = otGain > 0 ? 1.0 / (1.0 + 0.8 * otGain) : 1.0

      for i in 0..<Int(frameCount) {
        // Smooth gain ramp — prevents audible clicks on start/stop
        if self.currentGain < target {
          self.currentGain = min(target, self.currentGain + rampStep)
        } else if self.currentGain > target {
          self.currentGain = max(target, self.currentGain - rampStep)
        }

        var left  = Float(sin(self.phaseL))
        var right = Float(sin(self.phaseR))

        // Raised-cosine envelopes (0…1) — smooth, click-free AM per channel.
        // Peak level never exceeds p.volume, so no loudness compensation is
        // applied (avoids clipping when the noise layer is active).
        if p.amLeftDepth > 0 {
          let env = Float(0.5 * (1.0 - cos(self.amPhaseL)))
          left *= (1.0 - p.amLeftDepth) + p.amLeftDepth * env
          self.amPhaseL += amIncL
          if self.amPhaseL >= twoPi { self.amPhaseL -= twoPi }
        }
        if p.amRightDepth > 0 {
          let env = Float(0.5 * (1.0 - cos(self.amPhaseR)))
          right *= (1.0 - p.amRightDepth) + p.amRightDepth * env
          self.amPhaseR += amIncR
          if self.amPhaseR >= twoPi { self.amPhaseR -= twoPi }
        }

        // Golden Frequency overtone stack — additive, diotic (equal in both
        // ears), fully bypassed when gain is 0 so the legacy path is
        // bit-identical.
        if otGain > 0 {
          let stack = (0.4 * Float(sin(self.otPhaseHalf))
                     + 0.25 * Float(sin(self.otPhaseQuart))
                     + 0.15 * Float(sin(self.otPhaseOctave))) * otGain
          left  = (left  + stack) * otNorm
          right = (right + stack) * otNorm
          self.otPhaseHalf   += otInc2
          self.otPhaseQuart  += otInc4
          self.otPhaseOctave += otIncO
          if self.otPhaseHalf   >= twoPi { self.otPhaseHalf   -= twoPi }
          if self.otPhaseQuart  >= twoPi { self.otPhaseQuart  -= twoPi }
          if self.otPhaseOctave >= twoPi { self.otPhaseOctave -= twoPi }
        }

        // True per-channel isolation: L and R streams never blend
        leftPtr[i]  = left  * p.volume * self.currentGain
        rightPtr[i] = right * p.volume * self.currentGain

        self.phaseL += phaseIncL
        self.phaseR += phaseIncR

        // Wrap phases to prevent floating-point drift in long sessions
        if self.phaseL >= twoPi { self.phaseL -= twoPi }
        if self.phaseR >= twoPi { self.phaseR -= twoPi }
      }
      return noErr
    }
  }

  private func makeBrownNode(format: AVAudioFormat) -> AVAudioSourceNode {
    return AVAudioSourceNode(format: format) { [weak self] _, _, frameCount, audioBufferList in
      guard let self else { return noErr }

      os_unfair_lock_lock(&self.paramsLock)
      let brownEnabled = self.params.brownEnabled
      let pink         = self.params.pinkNoise
      let vol          = self.params.volume
      os_unfair_lock_unlock(&self.paramsLock)

      let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
      guard abl.count >= 2,
            let leftPtr  = abl[0].mData?.assumingMemoryBound(to: Float.self),
            let rightPtr = abl[1].mData?.assumingMemoryBound(to: Float.self)
      else { return noErr }

      guard brownEnabled else {
        // Zero-fill both channels when disabled — node stays connected to avoid graph churn
        memset(leftPtr,  0, Int(abl[0].mDataByteSize))
        memset(rightPtr, 0, Int(abl[1].mDataByteSize))
        return noErr
      }

      let noiseAmp = vol * 0.20   // Noise layer rides 20% of the tone volume

      for i in 0..<Int(frameCount) {
        let white = Double.random(in: -1.0...1.0)
        let raw: Double
        if pink {
          // Paul Kellett economy pink filter — ~-3 dB/octave, render-safe
          self.pinkB0 = 0.99765 * self.pinkB0 + white * 0.0990460
          self.pinkB1 = 0.96300 * self.pinkB1 + white * 0.2965164
          self.pinkB2 = 0.57000 * self.pinkB2 + white * 1.0526913
          raw = (self.pinkB0 + self.pinkB1 + self.pinkB2 + white * 0.1848) * 0.12
        } else {
          // First-order Brownian integrator — naturally bounded
          self.brownState = (self.brownState + white * 0.02) / 1.02
          raw = self.brownState
        }
        // Hard clip against rare large excursions then apply gain ramp
        let sample = Float(max(-1.0, min(1.0, raw))) * noiseAmp * self.currentGain
        leftPtr[i]  = sample
        rightPtr[i] = sample
      }
      return noErr
    }
  }

  // MARK: – Lock helper

  private func withParams(_ mutation: (inout RenderParams) -> Void) {
    os_unfair_lock_lock(&paramsLock)
    mutation(&params)
    os_unfair_lock_unlock(&paramsLock)
  }

  // MARK: – AVAudioSession notifications

  @objc private func handleInterruption(_ note: Notification) {
    guard
      let info = note.userInfo,
      let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: typeValue)
    else { return }

    switch type {
    case .began:
      if isRunning { engine.pause() }
    case .ended:
      let opts = AVAudioSession.InterruptionOptions(
        rawValue: info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
      )
      if opts.contains(.shouldResume) && isRunning {
        try? AVAudioSession.sharedInstance().setActive(true)
        try? engine.start()
      }
    @unknown default:
      break
    }
  }

  @objc private func handleRouteChange(_ note: Notification) {
    guard
      let info = note.userInfo,
      let reasonValue = info[AVAudioSessionRouteChangeReasonKey] as? UInt,
      let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue),
      isRunning
    else { return }

    switch reason {
    case .oldDeviceUnavailable:
      // Headphones unplugged — pause immediately to prevent speaker bleed
      engine.pause()
    case .newDeviceAvailable:
      // New output appeared (e.g. headphones reconnected) — resume
      try? engine.start()
    default:
      break
    }
  }
}
