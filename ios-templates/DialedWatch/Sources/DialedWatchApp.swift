import SwiftUI

/// Entry point for the Dialed watchOS companion target.
///
/// Setup after `npx expo prebuild`:
///   1. Xcode → File → New → Target → Watch App (watchOS)
///   2. Product name: DialedWatch  |  Bundle ID: com.brandonlo05.dialed.watchkitapp
///   3. Enable HealthKit capability on BOTH the iOS app target AND this watch target
///   4. Add WatchConnectivity.framework to the watch target
///   5. Copy Sources/ into the new watch target's source group
@main
struct DialedWatchApp: App {
    @StateObject private var workoutManager = WorkoutManager.shared

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ContentView()
                    .environmentObject(workoutManager)
            }
        }
    }
}
