import Foundation
import WatchConnectivity

/// Packet sent from watch → iOS every 2 seconds during an active session.
struct BiometricPacket: Codable {
    /// Instantaneous heart rate in beats per minute.
    let bpm: Double
    /// Derived inter-beat intervals (ms) collected since the last flush.
    /// Values are BPM-derived estimates; true beat-by-beat data requires HKHeartbeatSeriesQuery.
    let rrIntervals: [Double]
    /// Unix timestamp (seconds) at the time of flush on the watch.
    let timestamp: TimeInterval
}

/// Manages the WCSession delegate on the watch side and sends BiometricPacket JSON payloads
/// to the paired iOS host app via `sendMessageData`.
///
/// Delivery strategy:
///   • If the iOS app is reachable (foreground): sendMessageData for real-time delivery.
///   • If not reachable: drop silently — the iOS ring buffer tolerates gaps without crashing.
final class WatchConnectivityBridge: NSObject {
    static let shared = WatchConnectivityBridge()

    private let encoder = JSONEncoder()

    private override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func sendPacket(_ packet: BiometricPacket) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        guard let data = try? encoder.encode(packet) else {
            print("[DialedWatch] Failed to encode BiometricPacket")
            return
        }

        if session.isReachable {
            // Real-time path: iOS app is in foreground
            session.sendMessageData(data, replyHandler: nil) { error in
                print("[DialedWatch] sendMessageData error: \(error.localizedDescription)")
            }
        } else {
            // Best-effort path: iOS app backgrounded — transferUserInfo queues delivery
            // for when the app next wakes. Use only for non-time-critical batches.
            session.transferUserInfo(["biometricPacket": data])
        }
    }
}

// MARK: – WCSessionDelegate (watchOS subset — no inactive/deactivate callbacks)

extension WatchConnectivityBridge: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            print("[DialedWatch] WCSession activation error: \(error.localizedDescription)")
        } else {
            print("[DialedWatch] WCSession activated — state: \(activationState.rawValue)")
        }
    }
}
