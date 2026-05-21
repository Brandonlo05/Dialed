import ExpoModulesCore

public class DialedAudioModule: Module {
  private let engine = AudioEngineManager.shared

  public func definition() -> ModuleDefinition {
    Name("DialedAudio")

    AsyncFunction("startSession") { (config: [String: Any]) in
      let carrier = config["carrierHz"]       as? Double ?? 200
      let beat    = config["beatHz"]          as? Double ?? 10
      let brown   = config["brownNoiseEnabled"] as? Bool ?? false
      try self.engine.start(carrierHz: carrier, beatHz: beat, brownNoise: brown)
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
  }
}
