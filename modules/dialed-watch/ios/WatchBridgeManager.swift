import Foundation
import WatchConnectivity

/// Mirror of the watch-side struct — must match JSON field names exactly.
struct BiometricPacket: Codable {
    let bpm: Double
    let rrIntervals: [Double]
    let timestamp: TimeInterval
}

typealias PacketHandler = (BiometricPacket) -> Void

/// Singleton WCSession delegate on the iOS host side.
/// Receives BiometricPacket JSON payloads from the watch and forwards them
/// to the registered `onPacket` closure (wired up by DialedWatchModule).
final class WatchBridgeManager: NSObject {
    static let shared = WatchBridgeManager()

    /// Called on the main queue each time a valid packet arrives.
    var onPacket: PacketHandler?

    private let decoder = JSONDecoder()
    private var activated = false

    private override init() {}

    // MARK: – Activation

    /// Idempotent — safe to call multiple times from OnStartObserving.
    func activate() {
        guard !activated, WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
        activated = true
    }

    var isReachable: Bool {
        WCSession.isSupported() && WCSession.default.isReachable
    }

    // MARK: – Packet parsing

    private func handle(data: Data) {
        guard let packet = try? decoder.decode(BiometricPacket.self, from: data) else {
            print("[Dialed iOS] Failed to decode BiometricPacket (\(data.count) bytes)")
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.onPacket?(packet)
        }
    }
}

// MARK: – WCSessionDelegate (iOS — includes inactive/deactivate callbacks)

extension WatchBridgeManager: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            print("[Dialed iOS] WCSession activation error: \(error.localizedDescription)")
        } else {
            print("[Dialed iOS] WCSession activated — state: \(activationState.rawValue), reachable: \(session.isReachable)")
        }
    }

    // Required on iOS
    func sessionDidBecomeInactive(_ session: WCSession) {
        print("[Dialed iOS] WCSession became inactive")
    }

    func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate so the session is ready when a new watch is paired
        session.activate()
        print("[Dialed iOS] WCSession deactivated — reactivating")
    }

    // MARK: – Real-time path (sendMessageData from watch)

    func session(_ session: WCSession, didReceiveMessageData messageData: Data) {
        handle(data: messageData)
    }

    func session(
        _ session: WCSession,
        didReceiveMessageData messageData: Data,
        replyHandler: @escaping (Data) -> Void
    ) {
        handle(data: messageData)
        replyHandler(Data())   // Acknowledge with empty reply
    }

    // MARK: – Best-effort path (transferUserInfo from watch when iOS is backgrounded)

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        guard let data = userInfo["biometricPacket"] as? Data else { return }
        handle(data: data)
    }
}
