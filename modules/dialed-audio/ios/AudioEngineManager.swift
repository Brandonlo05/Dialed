import AVFoundation
import Foundation

/// Parallel iOS audio engine: binaural sine pair + optional brown noise, mixed with other apps.
final class AudioEngineManager {
  static let shared = AudioEngineManager()

  private let engine = AVAudioEngine()
  private var sourceNode: AVAudioSourceNode?
  private var brownNode: AVAudioSourceNode?
  private var isRunning = false

  private var carrierHz: Double = 200
  private var beatHz: Double = 10
  private var brownNoiseEnabled = false
  private var phaseL: Double = 0
  private var phaseR: Double = 0
  private var brownState: Double = 0

  private init() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInterruption),
      name: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance()
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleRouteChange),
      name: AVAudioSession.routeChangeNotification,
      object: AVAudioSession.sharedInstance()
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  func start(carrierHz: Double, beatHz: Double, brownNoise: Bool) throws {
    self.carrierHz = carrierHz
    self.beatHz = beatHz
    self.brownNoiseEnabled = brownNoise

    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
    try session.setActive(true)

    if isRunning {
      engine.stop()
      engine.reset()
      isRunning = false
    }

    attachNodes()
    try engine.start()
    isRunning = true
  }

  func stop() {
    guard isRunning else { return }
    engine.stop()
    engine.reset()
    isRunning = false
    phaseL = 0
    phaseR = 0
    brownState = 0
  }

  func setCarrierFrequency(_ hz: Double) {
    carrierHz = hz
  }

  func setBrownNoiseEnabled(_ enabled: Bool) {
    brownNoiseEnabled = enabled
  }

  private func attachNodes() {
    let format = engine.outputNode.inputFormat(forBus: 0)
    let sampleRate = format.sampleRate

    sourceNode = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList -> OSStatus in
      guard let self else { return noErr }
      let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
      let leftHz = self.carrierHz
      let rightHz = self.carrierHz + self.beatHz
      let amp: Float = 0.12

      for frame in 0..<Int(frameCount) {
        let sampleL = sin(self.phaseL) * Double(amp)
        let sampleR = sin(self.phaseR) * Double(amp)
        self.phaseL += 2 * .pi * leftHz / sampleRate
        self.phaseR += 2 * .pi * rightHz / sampleRate

        for buffer in abl {
          let ptr = buffer.mData?.assumingMemoryBound(to: Float.self)
          ptr?[frame] = Float(sampleL + sampleR) * 0.5
        }
      }
      return noErr
    }

    brownNode = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList -> OSStatus in
      guard let self, self.brownNoiseEnabled else { return noErr }
      let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
      let brownAmp: Float = 0.04

      for frame in 0..<Int(frameCount) {
        let white = Double.random(in: -1...1)
        self.brownState = (self.brownState + (0.02 * white)) / 1.02
        let sample = Float(self.brownState * Double(brownAmp))

        for buffer in abl {
          let ptr = buffer.mData?.assumingMemoryBound(to: Float.self)
          ptr?[frame] = sample
        }
      }
      return noErr
    }

    if let sourceNode {
      engine.attach(sourceNode)
      engine.connect(sourceNode, to: engine.mainMixerNode, format: format)
    }
    if let brownNode {
      engine.attach(brownNode)
      engine.connect(brownNode, to: engine.mainMixerNode, format: format)
    }
  }

  @objc private func handleInterruption(notification: Notification) {
    guard
      let userInfo = notification.userInfo,
      let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: typeValue)
    else { return }

    switch type {
    case .began:
      if isRunning { engine.pause() }
    case .ended:
      let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
      let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
      if options.contains(.shouldResume), isRunning {
        try? AVAudioSession.sharedInstance().setActive(true)
        try? engine.start()
      }
    @unknown default:
      break
    }
  }

  @objc private func handleRouteChange(_ notification: Notification) {
    guard isRunning else { return }
    try? engine.start()
  }
}
