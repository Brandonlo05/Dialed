import ExpoModulesCore

public class DialedWatchModule: Module {
    private let bridge = WatchBridgeManager.shared

    public func definition() -> ModuleDefinition {
        Name("DialedWatch")

        // JS-observable event emitted for every arriving BiometricPacket
        Events("onBiometricData")

        // Activate WCSession when the first JS listener attaches
        OnStartObserving {
            self.bridge.activate()
            self.bridge.onPacket = { [weak self] packet in
                self?.sendEvent("onBiometricData", [
                    "bpm":         packet.bpm,
                    "rrIntervals": packet.rrIntervals,
                    "timestamp":   packet.timestamp,
                ])
            }
        }

        // Release the closure when all JS listeners detach
        OnStopObserving {
            self.bridge.onPacket = nil
        }

        // Explicit activation for apps that call activateSession() before subscribing
        AsyncFunction("activateSession") {
            self.bridge.activate()
        }

        Function("isWatchReachable") -> Bool {
            self.bridge.isReachable
        }
    }
}
