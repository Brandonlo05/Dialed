import ExpoModulesCore

public class DialedAudioModule: Module {
  private let engine = AudioEngineManager.shared

  public func definition() -> ModuleDefinition {
    Name("DialedAudio")

    AsyncFunction("startSession") { (config: [String: Any]) in
      let carrier    = config["carrierHz"]         as? Double ?? 200
      let beat       = config["beatHz"]            as? Double ?? 10
      let noiseOn    = config["brownNoiseEnabled"] as? Bool   ?? false
      let noiseColor = config["noiseColor"]        as? String ?? "brown"

      // Per-channel AM envelopes (preset architecture)
      var amLeftHz     = config["amLeftHz"]     as? Double ?? 0
      var amLeftDepth  = config["amLeftDepth"]  as? Double ?? 0
      let amRightHz    = config["amRightHz"]    as? Double ?? 0
      let amRightDepth = config["amRightDepth"] as? Double ?? 0
      let overtone     = config["overtoneGain"] as? Double ?? 0

      // Legacy calibration keys — asymmetric SMR maps onto left-channel AM
      if (config["asymmetricSMR"] as? Bool ?? false) && amLeftDepth == 0 {
        amLeftHz    = config["smrHz"]    as? Double ?? 13.5
        amLeftDepth = config["smrDepth"] as? Double ?? 0.85
      }

      try self.engine.start(
        carrierHz: carrier,
        beatHz: beat,
        brownNoise: noiseOn,
        pinkNoise: noiseColor == "pink",
        amLeftHz: amLeftHz,
        amLeftDepth: Float(amLeftDepth),
        amRightHz: amRightHz,
        amRightDepth: Float(amRightDepth),
        overtoneGain: Float(overtone)
      )
    }

    AsyncFunction("stopSession") {
      self.engine.stop()
    }

    AsyncFunction("setCarrierFrequency") { (hz: Double) in
      self.engine.setCarrierFrequency(hz)
    }

    AsyncFunction("setBeatFrequency") { (hz: Double) in
      self.engine.setBeatFrequency(hz)
    }

    AsyncFunction("setVolume") { (level: Double) in
      self.engine.setVolume(Float(level))
    }

    AsyncFunction("setBrownNoiseEnabled") { (enabled: Bool) in
      self.engine.setBrownNoiseEnabled(enabled)
    }

    AsyncFunction("setNoiseColor") { (color: String) in
      self.engine.setNoiseColor(pink: color == "pink")
    }

    // Golden Frequency: Pythagorean overtone stack level (0–1)
    AsyncFunction("setOvertoneGain") { (gain: Double) in
      self.engine.setOvertoneGain(Float(gain))
    }

    // Gym Mode: native block-level frequency glide
    AsyncFunction("setBeatGlide") { (targetHz: Double, rateHzPerSec: Double, tauSeconds: Double) in
      self.engine.setBeatGlide(targetHz: targetHz, rateHzPerSec: rateHzPerSec, tauSeconds: tauSeconds)
    }

    // Gym Mode: isochronic pulse layer (level 0 = off)
    AsyncFunction("setIsochronic") { (level: Double, carrierHz: Double, rateHz: Double, depth: Double) in
      self.engine.setIsochronic(
        level: Float(level), carrierHz: carrierHz, rateHz: rateHz, depth: Float(depth)
      )
    }

    // Gym Mode: system ducking of other apps' audio (amount is OS-chosen)
    AsyncFunction("setDuckExternalAudio") { (enabled: Bool) in
      self.engine.setDuckExternalAudio(enabled)
    }

    // Independent per-channel AM — resolves after the engine has accepted
    // the parameters, so JS can await it and sequence haptics.
    AsyncFunction("setChannelModulation") { (leftHz: Double, leftDepth: Double, rightHz: Double, rightDepth: Double) in
      self.engine.setChannelModulation(
        leftHz: leftHz,
        leftDepth: Float(leftDepth),
        rightHz: rightHz,
        rightDepth: Float(rightDepth)
      )
    }

    // Legacy Left-Ear SMR toggle (calibration path + Neuro-Labs live link)
    AsyncFunction("setAsymmetricSMR") { (enabled: Bool, smrHz: Double, depth: Double) in
      self.engine.setAsymmetricSMR(enabled: enabled, smrHz: smrHz, depth: Float(depth))
    }
  }
}
