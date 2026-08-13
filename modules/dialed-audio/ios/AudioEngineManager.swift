import AVFoundation
import Foundation

enum AudioEngineError: Error {
  case formatUnavailable
}

/// True-stereo synthesis engine with independent per-channel modulation.
///
/// ── Signal paths ────────────────────────────────────────────────────────────
/// 1. Binaural (default): left = carrierHz, right = carrierHz + beatHz.
/// 2. Per-channel AM: each channel can carry its own raised-cosine amplitude
///    envelope (rate + depth), fully independent of the other. beatHz is
///    bypassed whenever any AM envelope is active.
/// 3. Pythagorean overtone stack (carrier/2, carrier/4, 2×carrier) — gated
///    behind overtoneGain; 0 leaves the legacy path bit-identical.
/// 4. Noise layer: Brownian (default) or pink (Paul Kellett 3-pole filter).
/// 5. Simper SVF low-shelf (trapezoidal-integration state variable filter)
///    per channel on the tone output — neutral (gain 0 dB) is mathematically
///    transparent while keeping filter state energy continuous, so live
///    parameter motion produces no zipper noise or transient pops.
///
/// ── Real-time thread invariants (com.apple.audio.IOThread) ─────────────────
/// - The render closures capture ONLY raw pointers and immutable value types:
///   no `self`, no class references — zero ARC traffic on the render thread.
/// - Parameter exchange is a lock-free C11 seqlock (DialedAtomic.h): the IO
///   thread validates-and-retries a plain struct copy; it can never block on
///   a lower-priority thread. (Swift 6 Synchronization.Atomic needs iOS 18+;
///   Dialed targets iOS 15.1, hence the stdatomic shim.)
/// - Parameters and filter coefficients are snapshot ONCE per audio block at
///   the top of the callback — never per frame.
/// - Noise uses an inline xorshift32 PRNG in render state; no Foundation
///   RNG (syscall path) on the IO thread.
/// - The sample rate is captured as an immutable value at graph-build time.
///   (AudioTimeStamp carries no mSampleRate field; the render format is
///   fixed for the life of the connected graph, and route changes rebuild
///   the graph through the route-change handler.)
/// - No artificial denormal guards: ARM64 FTZ/DAZ handles subnormals in
///   hardware.
/// - Spatial cross-feed: the stereo `.playback` chain performs no
///   spatialization; channels stay hard-isolated end to end.
///
/// AVAudioSession category .mixWithOthers keeps all other app audio
/// uninterrupted. Writer-side parameter mutation happens on the Expo module
/// serial queue (single logical writer), which is the seqlock's contract.
final class AudioEngineManager {
  static let shared = AudioEngineManager()

  // MARK: – Engine (main-thread only)
  private let engine = AVAudioEngine()
  private var binauralNode: AVAudioSourceNode?
  private var brownNode: AVAudioSourceNode?
  private var isRunning   = false
  /// System ducking of other apps' audio (main-thread state, not RT).
  private var duckExternal = false
  private var isFadingOut = false

  // MARK: – Parameter block (POD; published through the seqlock)
  private struct EngineParams {
    var carrierHz:     Double = 200
    var beatHz:        Double = 10
    var volume:        Float  = 0.25   // direct amplitude, 0–1 range
    var targetGain:    Float  = 1      // 0 = fade out, 1 = fade in
    var brownEnabled:  Bool   = false  // noise layer on/off
    var pinkNoise:     Bool   = false  // false = Brownian, true = pink
    // Independent per-channel AM envelopes (depth 0 = channel unmodulated)
    var amLeftHz:      Double = 0
    var amLeftDepth:   Float  = 0
    var amRightHz:     Double = 0
    var amRightDepth:  Float  = 0
    // Pythagorean overtone stack level (0 = off, bit-identical legacy path)
    var overtoneGain:  Float  = 0
    // Simper SVF low-shelf (0 dB = mathematically transparent)
    var shelfGainDb:   Float  = 0
    var shelfCutoffHz: Float  = 200
    var shelfQ:        Float  = 0.7071
    // ── Native frequency glide (Gym Mode tri-phasic sweeps) ──
    // Interpolated once per BLOCK, never per frame. When both rate and tau
    // are 0 the glide is bypassed and beatHz snaps — bit-identical legacy.
    var beatTargetHz:  Double = 10    // destination frequency
    var beatGlideRate: Double = 0     // Hz/sec, linear
    var beatGlideTau:  Double = 0     // >0 → exponential approach (overrides rate)
    // ── Isochronic pulse layer (Phase II peak drive) ──
    // Square gate on a dedicated carrier, mixed diotically alongside the
    // binaural pair. Level 0 bypasses the whole path.
    var isoLevel:      Float  = 0     // 0 = layer off
    var isoCarrierHz:  Double = 1000
    var isoRateHz:     Double = 40
    var isoDepth:      Float  = 1
    // ── Breath-synchronised master envelope ──
    // The four pacer stages in seconds. The engine swells on inhale and
    // recedes on exhale so the SOUND leads the breath instead of merely
    // sitting alongside it. Applied to both channels equally, after the
    // per-channel AM, so the interaural difference is never disturbed.
    // Depth 0 bypasses the whole path.
    var breathIn:    Float = 0
    var breathHold:  Float = 0
    var breathOut:   Float = 0
    var breathRest:  Float = 0
    var breathDepth: Float = 0
    // ── Transition ping ──
    // A monotonically increasing counter, NOT a bool: the render thread
    // compares it against its own last-seen value, so a trigger can never be
    // missed or double-fired regardless of block boundaries, and no
    // handshake / clear-flag write back to the writer is needed.
    var pingSeq:       UInt32 = 0
  }

  // MARK: – Render-thread state (POD; owned by the IO thread after start)
  private struct RenderState {
    var phaseL:      Double = 0
    var phaseR:      Double = 0
    var amPhaseL:    Double = 0
    var amPhaseR:    Double = 0
    var otPhaseHalf:   Double = 0  // carrier / 2 (216 Hz on a 432 carrier)
    var otPhaseQuart:  Double = 0  // carrier / 4 (108 Hz)
    var otPhaseOctave: Double = 0  // carrier × 2 (864 Hz)
    var currentGain: Float  = 0
    var brownState:  Double = 0
    // Pink noise filter poles (Paul Kellett economy approximation)
    var pinkB0: Double = 0
    var pinkB1: Double = 0
    var pinkB2: Double = 0
    // Inline PRNG — no Foundation RNG on the IO thread
    var rng: UInt32 = 0x9E3779B9
    // Simper SVF integrator state, per channel (trapezoidal integration)
    var svfL1: Float = 0
    var svfL2: Float = 0
    var svfR1: Float = 0
    var svfR2: Float = 0
    // Glide + isochronic layer state (render-thread exclusive)
    var beatCurrent: Double = 10
    var isoPhase:    Double = 0   // 1000 Hz carrier phase
    var isoGate:     Double = 0   // 40 Hz gate phase
    /// Seconds elapsed into the current breath cycle (render-thread only).
    var breathPos: Double = 0
    // Transition ping (stack-resident POD; no allocation on trigger)
    var pingSeen:      UInt32 = 0
    var pingRemaining: Int    = 0
    var pingPhase:     Double = 0
  }

  /// Simper low-shelf coefficients — computed once per block from the
  /// parameter snapshot (cytomic "Solving the continuous SVF equations
  /// using trapezoidal integration" formulation).
  private struct SVFCoeffs {
    var a1: Float = 0, a2: Float = 0, a3: Float = 0
    var m1: Float = 0, m2: Float = 0
    var neutral: Bool = true

    @inline(__always)
    static func lowShelf(gainDb: Float, cutoffHz: Float, q: Float, sampleRate: Float) -> SVFCoeffs {
      var c = SVFCoeffs()
      c.neutral = abs(gainDb) < 0.01
      let A = powf(10.0, gainDb / 40.0)
      let w0 = min(Float.pi * cutoffHz / sampleRate, Float.pi * 0.49)
      let g = tanf(w0) / sqrtf(max(A, 1.0e-6))
      let k = 1.0 / max(q, 0.05)
      c.a1 = 1.0 / (1.0 + g * (g + k))
      c.a2 = g * c.a1
      c.a3 = g * c.a2
      c.m1 = k * (A - 1.0)
      c.m2 = A * A - 1.0
      return c
    }
  }

  // Stable heap slots shared with the render closures via raw pointers.
  private let paramSlot: UnsafeMutablePointer<EngineParams>
  private let seqPtr: UnsafeMutablePointer<da_seqlock>
  private let statePtr: UnsafeMutablePointer<RenderState>

  // MARK: – Init / deinit

  private init() {
    paramSlot = .allocate(capacity: 1)
    paramSlot.initialize(to: EngineParams())
    seqPtr = .allocate(capacity: 1)
    da_seq_init(seqPtr)
    statePtr = .allocate(capacity: 1)
    statePtr.initialize(to: RenderState())

    let nc = NotificationCenter.default
    nc.addObserver(self, selector: #selector(handleInterruption(_:)),
                   name: AVAudioSession.interruptionNotification, object: nil)
    nc.addObserver(self, selector: #selector(handleRouteChange(_:)),
                   name: AVAudioSession.routeChangeNotification,  object: nil)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    immediatelySilence() // engine.stop() is synchronous — callbacks done on return
    paramSlot.deinitialize(count: 1)
    paramSlot.deallocate()
    seqPtr.deallocate()
    statePtr.deinitialize(count: 1)
    statePtr.deallocate()
  }

  // MARK: – Lock-free writer (non-RT threads only; single logical writer)

  private func mutateParams(_ mutation: (inout EngineParams) -> Void) {
    da_seq_write_begin(seqPtr)
    mutation(&paramSlot.pointee)
    da_seq_write_end(seqPtr)
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
    mutateParams {
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
    // .mixWithOthers keeps Spotify/Apple Music playing underneath us;
    // .allowBluetoothA2DP keeps full-bandwidth stereo over BT headphones
    // (without it, a BT route can negotiate down to mono HFP and destroy
    // the interaural difference the whole engine depends on).
    try session.setCategory(
      .playback, mode: .default,
      options: duckExternal ? [.mixWithOthers, .allowBluetoothA2DP, .duckOthers]
                            : [.mixWithOthers, .allowBluetoothA2DP]
    )
    try session.setActive(true)

    // Reset render-thread state; render callbacks haven't started yet
    statePtr.pointee = RenderState()

    try buildGraph()
    try engine.start()
    isRunning   = true
    isFadingOut = false
  }

  func stop() {
    guard isRunning, !isFadingOut else { return }
    mutateParams { $0.targetGain = 0 }
    isFadingOut = true
    // Allow ~20ms for the 12ms gain ramp + one buffer of headroom
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) { [weak self] in
      self?.immediatelySilence()
    }
  }

  func setCarrierFrequency(_ hz: Double)       { mutateParams { $0.carrierHz    = hz } }
  func setBeatFrequency(_ hz: Double)          { mutateParams { $0.beatHz       = hz } }
  func setVolume(_ level: Float)               { mutateParams { $0.volume       = max(0, min(1, level)) } }
  func setBrownNoiseEnabled(_ enabled: Bool)   { mutateParams { $0.brownEnabled = enabled } }

  /// Set both per-channel AM envelopes live. Depth 0 disables a channel's
  /// modulation. The render callback picks changes up on its next block;
  /// the raised-cosine envelope keeps transitions click-free.
  func setChannelModulation(leftHz: Double, leftDepth: Float, rightHz: Double, rightDepth: Float) {
    mutateParams {
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
    mutateParams { $0.pinkNoise = pink }
  }

  /// Pythagorean overtone stack level (0 = off, bit-identical legacy path).
  func setOvertoneGain(_ gain: Float) {
    mutateParams { $0.overtoneGain = max(0, min(1, gain)) }
  }

  /// Native frequency glide. `rateHzPerSec > 0` ramps linearly;
  /// `tauSeconds > 0` approaches exponentially and takes precedence.
  /// Both 0 snaps immediately (legacy behaviour).
  func setBeatGlide(targetHz: Double, rateHzPerSec: Double, tauSeconds: Double) {
    mutateParams {
      $0.beatTargetHz  = max(0, min(45, targetHz))
      $0.beatGlideRate = max(0, rateHzPerSec)
      $0.beatGlideTau  = max(0, tauSeconds)
    }
  }

  /// Lock the master swell to the breath pacer's cycle. Passing the four
  /// stage durations (not a rate) is what lets the audio track an asymmetric
  /// pattern like 4-2-8-2 exactly. Depth 0 disables the path; the phase is
  /// reset so the swell starts on an inhale in step with the on-screen ring.
  func setBreathEnvelope(
    inhale: Float, hold: Float, exhale: Float, rest: Float, depth: Float
  ) {
    mutateParams {
      $0.breathIn    = max(0, inhale)
      $0.breathHold  = max(0, hold)
      $0.breathOut   = max(0, exhale)
      $0.breathRest  = max(0, rest)
      $0.breathDepth = max(0, min(0.8, depth)) // capped — never fades to silence
    }
    statePtr.pointee.breathPos = 0
  }

  /// Fire the transition ping. Increments a sequence counter the render
  /// thread latches — cannot be missed or double-fired.
  func triggerPing() {
    mutateParams { $0.pingSeq &+= 1 }
  }

  /// Isochronic pulse layer. `level` 0 disables the entire path.
  func setIsochronic(level: Float, carrierHz: Double, rateHz: Double, depth: Float) {
    mutateParams {
      $0.isoLevel     = max(0, min(1, level))
      $0.isoCarrierHz = max(20, min(4000, carrierHz))
      $0.isoRateHz    = max(0.5, min(80, rateHz))
      $0.isoDepth     = max(0, min(1, depth))
    }
  }

  /// Toggle system ducking of OTHER apps' audio.
  ///
  /// iOS exposes no API to filter or gain-stage another process's audio, so
  /// the attenuation amount and curve are chosen by the system — a custom
  /// −4.5 dB / 150 ms sidechain is not achievable from inside our process.
  /// Re-applies the session category, so this is main-thread only and is
  /// never reachable from a render callback.
  func setDuckExternalAudio(_ enabled: Bool) {
    duckExternal = enabled
    guard isRunning else { return }
    try? AVAudioSession.sharedInstance().setCategory(
      .playback, mode: .default,
      options: enabled ? [.mixWithOthers, .allowBluetoothA2DP, .duckOthers]
                       : [.mixWithOthers, .allowBluetoothA2DP]
    )
  }

  /// Simper SVF low-shelf warmth stage. 0 dB is exactly transparent.
  func setLowShelf(gainDb: Float, cutoffHz: Float, q: Float) {
    mutateParams {
      $0.shelfGainDb   = max(-24, min(24, gainDb))
      $0.shelfCutoffHz = max(20, min(2000, cutoffHz))
      $0.shelfQ        = max(0.1, min(4, q))
    }
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
    statePtr.pointee.currentGain = 0
  }

  private func buildGraph() throws {
    let outputRate = engine.outputNode.outputFormat(forBus: 0).sampleRate
    let sampleRate = outputRate > 0 ? outputRate : 44_100.0

    guard let stereo = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2) else {
      throw AudioEngineError.formatUnavailable
    }

    let binaural = makeBinauralNode(format: stereo, sampleRate: sampleRate)
    let brown    = makeNoiseNode(format: stereo)

    engine.attach(binaural)
    engine.attach(brown)
    engine.connect(binaural, to: engine.mainMixerNode, format: stereo)
    engine.connect(brown,    to: engine.mainMixerNode, format: stereo)

    binauralNode = binaural
    brownNode    = brown
  }

  // MARK: – Node factories
  //
  // Closures capture ONLY raw pointers and value constants — no `self`,
  // no class references, no ARC on the IO thread.

  private func makeBinauralNode(format: AVAudioFormat, sampleRate: Double) -> AVAudioSourceNode {
    let twoPi    = 2.0 * Double.pi
    let rampStep = Float(1.0 / (0.012 * sampleRate))   // 12 ms ramp
    let slot = paramSlot
    let seq = seqPtr
    let state = statePtr
    let floatSampleRate = Float(sampleRate)

    return AVAudioSourceNode(format: format) { _, _, frameCount, audioBufferList in
      let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
      guard abl.count >= 2,
            let leftPtr  = abl[0].mData?.assumingMemoryBound(to: Float.self),
            let rightPtr = abl[1].mData?.assumingMemoryBound(to: Float.self)
      else { return noErr }

      // 1) Snapshot parameters ONCE per block via the lock-free seqlock.
      var p = EngineParams()
      var v: UInt32
      repeat {
        v = da_seq_read_begin(seq)
        p = slot.pointee
      } while da_seq_read_retry(seq, v)

      // 2) Block-level derived coefficients — never per frame.
      // ── Block-level frequency glide (tri-phasic sweeps) ──
      // Advanced ONCE per block, never per frame. With both glide fields at
      // 0 this snaps to p.beatHz — bit-identical to the pre-Gym path.
      let blockSeconds = Double(frameCount) / sampleRate
      if p.beatGlideTau > 0 {
        // Exponential approach: dx = (target - x)(1 - e^(-dt/tau))
        let k = 1.0 - exp(-blockSeconds / p.beatGlideTau)
        state.pointee.beatCurrent += (p.beatTargetHz - state.pointee.beatCurrent) * k
      } else if p.beatGlideRate > 0 {
        // Linear ramp, clamped so it lands exactly on target
        let step = p.beatGlideRate * blockSeconds
        let delta = p.beatTargetHz - state.pointee.beatCurrent
        state.pointee.beatCurrent += delta > 0 ? min(step, delta) : max(-step, delta)
      } else {
        state.pointee.beatCurrent = p.beatHz
      }
      let beatNow = state.pointee.beatCurrent

      let amActive  = p.amLeftDepth > 0 || p.amRightDepth > 0
      let phaseIncL = p.carrierHz * twoPi / sampleRate
      let phaseIncR = (p.carrierHz + (amActive ? 0 : beatNow)) * twoPi / sampleRate
      let amIncL    = p.amLeftHz  * twoPi / sampleRate
      let amIncR    = p.amRightHz * twoPi / sampleRate
      let target    = p.targetGain

      // ── Isochronic pulse layer (Phase II) ──
      // Square gate with raised-cosine edges. A hard square would emit a
      // click every transition (infinite slew); a ~2 ms edge is perceptually
      // still a square pulse but band-limits the discontinuity.
      let isoLevel = p.isoLevel
      let isoInc   = p.isoCarrierHz * twoPi / sampleRate
      let isoGInc  = p.isoRateHz / sampleRate          // 0…1 gate cycle per sample
      let isoEdge  = min(0.25, max(0.002, 0.002 * p.isoRateHz)) // edge as gate fraction

      // ── Transition ping (1200 Hz, 100 ms, −12 dBFS) ──
      // Latch a new trigger once per block. Arming is two integer writes;
      // no allocation, no branching on the writer's behalf.
      if p.pingSeq != state.pointee.pingSeen {
        state.pointee.pingSeen = p.pingSeq
        state.pointee.pingRemaining = Int(0.100 * sampleRate)
        state.pointee.pingPhase = 0
      }
      // ── Breath envelope constants (block level) ──
      let brDepth = p.breathDepth
      let brTotal = Double(p.breathIn + p.breathHold + p.breathOut + p.breathRest)
      let brInc   = brTotal > 0 ? 1.0 / sampleRate : 0.0
      let brIn    = Double(p.breathIn)
      let brHoldE = brIn + Double(p.breathHold)
      let brOutE  = brHoldE + Double(p.breathOut)

      let pingInc = 1200.0 * twoPi / sampleRate
      let pingLen = Double(max(1, Int(0.100 * sampleRate)))
      let pingAmp: Float = 0.251  // 10^(−12/20)

      let otGain  = p.overtoneGain
      let otInc2  = (p.carrierHz / 2) * twoPi / sampleRate
      let otInc4  = (p.carrierHz / 4) * twoPi / sampleRate
      let otIncO  = (p.carrierHz * 2) * twoPi / sampleRate
      let otNorm: Float = otGain > 0 ? 1.0 / (1.0 + 0.8 * otGain) : 1.0

      let shelf = SVFCoeffs.lowShelf(
        gainDb: p.shelfGainDb, cutoffHz: p.shelfCutoffHz, q: p.shelfQ,
        sampleRate: floatSampleRate
      )

      let s = state // local pointer alias for the frame loop

      // 3) Frame loop — pure arithmetic on POD state.
      for i in 0..<Int(frameCount) {
        // Smooth gain ramp — prevents audible clicks on start/stop
        if s.pointee.currentGain < target {
          s.pointee.currentGain = min(target, s.pointee.currentGain + rampStep)
        } else if s.pointee.currentGain > target {
          s.pointee.currentGain = max(target, s.pointee.currentGain - rampStep)
        }

        var left  = Float(sin(s.pointee.phaseL))
        var right = Float(sin(s.pointee.phaseR))

        // Raised-cosine envelopes (0…1) — smooth, click-free AM per channel.
        if p.amLeftDepth > 0 {
          let env = Float(0.5 * (1.0 - cos(s.pointee.amPhaseL)))
          left *= (1.0 - p.amLeftDepth) + p.amLeftDepth * env
          s.pointee.amPhaseL += amIncL
          if s.pointee.amPhaseL >= twoPi { s.pointee.amPhaseL -= twoPi }
        }
        if p.amRightDepth > 0 {
          let env = Float(0.5 * (1.0 - cos(s.pointee.amPhaseR)))
          right *= (1.0 - p.amRightDepth) + p.amRightDepth * env
          s.pointee.amPhaseR += amIncR
          if s.pointee.amPhaseR >= twoPi { s.pointee.amPhaseR -= twoPi }
        }

        // Golden Frequency overtone stack — additive, diotic, fully bypassed
        // at gain 0 so the legacy path is bit-identical.
        if otGain > 0 {
          let stack = (0.4 * Float(sin(s.pointee.otPhaseHalf))
                     + 0.25 * Float(sin(s.pointee.otPhaseQuart))
                     + 0.15 * Float(sin(s.pointee.otPhaseOctave))) * otGain
          left  = (left  + stack) * otNorm
          right = (right + stack) * otNorm
          s.pointee.otPhaseHalf   += otInc2
          s.pointee.otPhaseQuart  += otInc4
          s.pointee.otPhaseOctave += otIncO
          if s.pointee.otPhaseHalf   >= twoPi { s.pointee.otPhaseHalf   -= twoPi }
          if s.pointee.otPhaseQuart  >= twoPi { s.pointee.otPhaseQuart  -= twoPi }
          if s.pointee.otPhaseOctave >= twoPi { s.pointee.otPhaseOctave -= twoPi }
        }

        // Simper SVF low-shelf (trapezoidal integration). State always
        // integrates — energy continuity — but the tap mix is exactly
        // transparent at 0 dB (m1 = m2 = 0).
        if !shelf.neutral {
          let v3L = left - s.pointee.svfL2
          let v1L = shelf.a1 * s.pointee.svfL1 + shelf.a2 * v3L
          let v2L = s.pointee.svfL2 + shelf.a2 * s.pointee.svfL1 + shelf.a3 * v3L
          s.pointee.svfL1 = 2.0 * v1L - s.pointee.svfL1
          s.pointee.svfL2 = 2.0 * v2L - s.pointee.svfL2
          left = left + shelf.m1 * v1L + shelf.m2 * v2L

          let v3R = right - s.pointee.svfR2
          let v1R = shelf.a1 * s.pointee.svfR1 + shelf.a2 * v3R
          let v2R = s.pointee.svfR2 + shelf.a2 * s.pointee.svfR1 + shelf.a3 * v3R
          s.pointee.svfR1 = 2.0 * v1R - s.pointee.svfR1
          s.pointee.svfR2 = 2.0 * v2R - s.pointee.svfR2
          right = right + shelf.m1 * v1R + shelf.m2 * v2R
        }

        // Isochronic pulse layer — diotic (identical both ears), additive.
        // Bypassed entirely at level 0 so the legacy path is untouched.
        if isoLevel > 0 {
          let g = s.pointee.isoGate
          // Nominal 50% square with raised-cosine edges (~2 ms at 40 Hz).
          // The edges cut into the on-time, so measured duty at half
          // amplitude is (0.5 − isoEdge) ≈ 42% — intended: pulse RATE is
          // what entrains, and the softened edge is what prevents a click
          // at every transition.
          var gate: Float
          if g < isoEdge {
            gate = Float(0.5 * (1.0 - cos(Double.pi * g / isoEdge)))
          } else if g < 0.5 - isoEdge {
            gate = 1
          } else if g < 0.5 {
            gate = Float(0.5 * (1.0 + cos(Double.pi * (g - (0.5 - isoEdge)) / isoEdge)))
          } else {
            gate = 0
          }
          // Depth 1.0 = full on/off gating; lower depth lifts the floor
          let env = (1 - p.isoDepth) + p.isoDepth * gate
          let iso = Float(sin(s.pointee.isoPhase)) * env * isoLevel
          left  += iso
          right += iso

          s.pointee.isoPhase += isoInc
          if s.pointee.isoPhase >= twoPi { s.pointee.isoPhase -= twoPi }
          s.pointee.isoGate += isoGInc
          if s.pointee.isoGate >= 1 { s.pointee.isoGate -= 1 }
        }

        // Transition ping — raised-cosine window over the full 100 ms so it
        // fades in and out cleanly instead of clicking at either end. Sits
        // OUTSIDE the master volume so the cue stays audible when the user
        // is running the engine quietly under loud music.
        if s.pointee.pingRemaining > 0 {
          let progress = 1.0 - Double(s.pointee.pingRemaining) / pingLen
          let win = Float(0.5 * (1.0 - cos(twoPi * progress)))
          let ping = Float(sin(s.pointee.pingPhase)) * win * pingAmp
          left  += ping
          right += ping
          s.pointee.pingPhase += pingInc
          if s.pointee.pingPhase >= twoPi { s.pointee.pingPhase -= twoPi }
          s.pointee.pingRemaining -= 1
        }

        // ── Breath-synchronised swell ──
        // Rises through the inhale, holds at the top, falls through the
        // exhale, rests at the floor — the exact shape the pacer draws, so
        // the sound and the ring move together. Raised-cosine edges keep it
        // click-free; depth sets how far it recedes (never to silence).
        var brEnv: Float = 1
        if brDepth > 0 && brTotal > 0 {
          let pos = s.pointee.breathPos
          var shape: Double
          if pos < brIn {
            shape = brIn > 0 ? 0.5 * (1.0 - cos(Double.pi * (pos / brIn))) : 1.0
          } else if pos < brHoldE {
            shape = 1.0
          } else if pos < brOutE {
            let u = (pos - brHoldE) / max(0.0001, brOutE - brHoldE)
            shape = 0.5 * (1.0 + cos(Double.pi * u))
          } else {
            shape = 0.0
          }
          brEnv = (1.0 - brDepth) + brDepth * Float(shape)
          s.pointee.breathPos += brInc
          if s.pointee.breathPos >= brTotal { s.pointee.breathPos -= brTotal }
        }

        // True per-channel isolation: L and R streams never blend
        leftPtr[i]  = left  * p.volume * s.pointee.currentGain * brEnv
        rightPtr[i] = right * p.volume * s.pointee.currentGain * brEnv

        s.pointee.phaseL += phaseIncL
        s.pointee.phaseR += phaseIncR

        // Wrap phases to prevent floating-point drift in long sessions
        if s.pointee.phaseL >= twoPi { s.pointee.phaseL -= twoPi }
        if s.pointee.phaseR >= twoPi { s.pointee.phaseR -= twoPi }
      }
      return noErr
    }
  }

  private func makeNoiseNode(format: AVAudioFormat) -> AVAudioSourceNode {
    let slot = paramSlot
    let seq = seqPtr
    let state = statePtr

    return AVAudioSourceNode(format: format) { _, _, frameCount, audioBufferList in
      let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
      guard abl.count >= 2,
            let leftPtr  = abl[0].mData?.assumingMemoryBound(to: Float.self),
            let rightPtr = abl[1].mData?.assumingMemoryBound(to: Float.self)
      else { return noErr }

      // Snapshot ONCE per block (seqlock, no locks)
      var p = EngineParams()
      var v: UInt32
      repeat {
        v = da_seq_read_begin(seq)
        p = slot.pointee
      } while da_seq_read_retry(seq, v)

      guard p.brownEnabled else {
        // Zero-fill both channels when disabled — node stays connected to
        // avoid graph churn
        memset(leftPtr,  0, Int(abl[0].mDataByteSize))
        memset(rightPtr, 0, Int(abl[1].mDataByteSize))
        return noErr
      }

      let noiseAmp = p.volume * 0.20   // Noise layer rides 20% of the tone volume
      let pink = p.pinkNoise
      let s = state

      for i in 0..<Int(frameCount) {
        // Inline xorshift32 — no Foundation RNG (syscall path) on the IO thread
        var r = s.pointee.rng
        r ^= r << 13
        r ^= r >> 17
        r ^= r << 5
        s.pointee.rng = r
        let white = Double(Int32(bitPattern: r)) * (1.0 / 2147483648.0)

        let raw: Double
        if pink {
          // Paul Kellett economy pink filter — ~-3 dB/octave, render-safe
          s.pointee.pinkB0 = 0.99765 * s.pointee.pinkB0 + white * 0.0990460
          s.pointee.pinkB1 = 0.96300 * s.pointee.pinkB1 + white * 0.2965164
          s.pointee.pinkB2 = 0.57000 * s.pointee.pinkB2 + white * 1.0526913
          raw = (s.pointee.pinkB0 + s.pointee.pinkB1 + s.pointee.pinkB2 + white * 0.1848) * 0.12
        } else {
          // First-order Brownian integrator — naturally bounded
          s.pointee.brownState = (s.pointee.brownState + white * 0.02) / 1.02
          raw = s.pointee.brownState
        }
        // Hard clip against rare large excursions then apply gain ramp
        let sample = Float(max(-1.0, min(1.0, raw))) * noiseAmp * s.pointee.currentGain
        leftPtr[i]  = sample
        rightPtr[i] = sample
      }
      return noErr
    }
  }

  // MARK: – AVAudioSession notifications (main thread — never the IO thread)

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
