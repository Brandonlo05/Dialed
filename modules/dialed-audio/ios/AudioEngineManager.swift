import AVFoundation
import Foundation

enum AudioEngineError: Error {
  case formatUnavailable
}

/// True-stereo binaural engine: left channel = carrierHz, right = carrierHz + beatHz.
/// AVAudioSession category .mixWithOthers keeps Spotify and all other apps uninterrupted.
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
    var brownEnabled: Bool   = false
    var targetGain:   Float  = 1      // 0 = fade out, 1 = fade in
  }
  private var params     = RenderParams()
  private var paramsLock = os_unfair_lock()

  // MARK: – Render-thread-exclusive state (never touched from other threads)
  private var phaseL:     Double = 0
  private var phaseR:     Double = 0
  private var brownState: Double = 0
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

  func start(carrierHz: Double, beatHz: Double, brownNoise: Bool) throws {
    withParams {
      $0.carrierHz    = carrierHz
      $0.beatHz       = beatHz
      $0.brownEnabled = brownNoise
      $0.targetGain   = 1
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
    brownState  = 0

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

      let phaseIncL = p.carrierHz           * twoPi / sampleRate
      let phaseIncR = (p.carrierHz + p.beatHz) * twoPi / sampleRate
      let target    = p.targetGain

      for i in 0..<Int(frameCount) {
        // Smooth gain ramp — prevents audible clicks on start/stop
        if self.currentGain < target {
          self.currentGain = min(target, self.currentGain + rampStep)
        } else if self.currentGain > target {
          self.currentGain = max(target, self.currentGain - rampStep)
        }

        // True stereo: L ≠ R — this is what creates the binaural beat
        leftPtr[i]  = Float(sin(self.phaseL)) * p.volume * self.currentGain
        rightPtr[i] = Float(sin(self.phaseR)) * p.volume * self.currentGain

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

      let brownAmp = vol * 0.20   // Brown noise rides 20% of the binaural volume

      for i in 0..<Int(frameCount) {
        let white = Double.random(in: -1.0...1.0)
        // First-order Brownian integrator — naturally bounded
        self.brownState = (self.brownState + white * 0.02) / 1.02
        // Hard clip against rare large excursions then apply gain ramp
        let sample = Float(max(-1.0, min(1.0, self.brownState))) * brownAmp * self.currentGain
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
