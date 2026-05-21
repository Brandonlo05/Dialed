import Foundation
import HealthKit

/// Manages an HKWorkoutSession to keep the optical heart-rate sensor pinned at full sample rate
/// even when the user drops their wrist. Without an active session, watchOS aggressively throttles
/// HR sampling within seconds of wrist-down detection.
///
/// Data flow:
///   HKLiveWorkoutBuilder delegate → BPM → derive RR interval (ms)
///   → 2-second batched packet → WatchConnectivityBridge → iOS host ring buffer
final class WorkoutManager: NSObject, ObservableObject {
    static let shared = WorkoutManager()

    // MARK: – Published state (main-thread)
    @Published private(set) var currentBPM: Double?
    @Published private(set) var isSessionActive = false

    // MARK: – HealthKit
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var workoutBuilder: HKLiveWorkoutBuilder?
    private var sessionStartDate: Date?

    // MARK: – Pending batch (accumulated between flushes)
    private var pendingBPM: Double = 0
    private var pendingRR: [Double] = []
    private var flushTimer: Timer?

    private override init() {}

    // MARK: – Authorization

    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        let readTypes: Set<HKSampleType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.heartRateVariabilitySDNN),
        ]
        do {
            // toShare: [] — we write workout data only through the builder, not raw samples
            try await healthStore.requestAuthorization(toShare: [HKWorkoutType.workoutType()], read: readTypes)
        } catch {
            print("[DialedWatch] HealthKit auth error: \(error)")
        }
    }

    // MARK: – Session lifecycle

    func startSession() {
        let config = HKWorkoutConfiguration()
        config.activityType = .mindAndBody   // Correct activity type for focus/mindfulness
        config.locationType = .indoor

        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            let builder = session.associatedWorkoutBuilder()

            // Wire up the live data source so the builder auto-collects HR during the session
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: config
            )

            session.delegate = self
            builder.delegate = self

            let now = Date()
            sessionStartDate = now
            session.startActivity(with: now)
            builder.beginCollection(withStart: now) { _, error in
                if let error { print("[DialedWatch] Builder beginCollection error: \(error)") }
            }

            workoutSession = session
            workoutBuilder = builder

            startFlushTimer()

            DispatchQueue.main.async { self.isSessionActive = true }
        } catch {
            print("[DialedWatch] HKWorkoutSession start error: \(error)")
        }
    }

    func stopSession() {
        flushTimer?.invalidate()
        flushTimer = nil

        workoutSession?.end()
        workoutBuilder?.endCollection(withEnd: Date()) { [weak self] _, error in
            if let error { print("[DialedWatch] endCollection error: \(error)") }
            self?.workoutBuilder?.finishWorkout { _, error in
                if let error { print("[DialedWatch] finishWorkout error: \(error)") }
            }
        }

        workoutSession = nil
        workoutBuilder = nil
        sessionStartDate = nil

        DispatchQueue.main.async {
            self.isSessionActive = false
            self.currentBPM = nil
            self.pendingBPM = 0
            self.pendingRR.removeAll()
        }
    }

    // MARK: – Flush timer (2-second batching window)

    private func startFlushTimer() {
        // Scheduled on the main run loop; all pendingXxx mutations go through main queue
        flushTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.flushPendingData()
        }
    }

    private func flushPendingData() {
        guard pendingBPM > 0 else { return }

        let packet = BiometricPacket(
            bpm: pendingBPM,
            rrIntervals: pendingRR,
            timestamp: Date().timeIntervalSince1970
        )
        pendingRR.removeAll(keepingCapacity: true)

        WatchConnectivityBridge.shared.sendPacket(packet)
    }
}

// MARK: – HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        print("[DialedWatch] Session state: \(fromState.rawValue) → \(toState.rawValue)")
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("[DialedWatch] Session error: \(error)")
    }
}

// MARK: – HKLiveWorkoutBuilderDelegate

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        let hrType = HKQuantityType(.heartRate)
        guard collectedTypes.contains(hrType) else { return }

        // statistics(for:) is thread-safe to read from the builder delegate callback
        guard
            let stats = workoutBuilder.statistics(for: hrType),
            let quantity = stats.mostRecentQuantity()
        else { return }

        let bpmUnit = HKUnit.count().unitDivided(by: .minute())
        let bpm = quantity.doubleValue(for: bpmUnit)
        guard bpm > 0 else { return }

        // Derive inter-beat interval from instantaneous BPM.
        // Physiological validity: clamp to 33–200 BPM (300–1800 ms).
        let rrMs = (60_000.0 / bpm).clamped(to: 300...1800)

        DispatchQueue.main.async {
            self.currentBPM = bpm
            self.pendingBPM = bpm
            self.pendingRR.append(rrMs)
        }
    }
}

// MARK: – Comparable clamp helper

private extension Double {
    func clamped(to range: ClosedRange<Double>) -> Double {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
