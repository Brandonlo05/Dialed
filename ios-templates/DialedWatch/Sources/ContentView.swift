import SwiftUI

struct ContentView: View {
    @EnvironmentObject var workoutManager: WorkoutManager

    var body: some View {
        VStack(spacing: 6) {
            Text("DIALED")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(3)
                .foregroundStyle(.purple)

            Spacer()

            // Live BPM readout
            Group {
                if let bpm = workoutManager.currentBPM {
                    Text("\(Int(bpm.rounded()))")
                        .font(.system(size: 48, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                } else {
                    Text("—")
                        .font(.system(size: 48, weight: .black, design: .rounded))
                        .foregroundStyle(.secondary)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: workoutManager.currentBPM)

            Text("BPM")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)

            // Session status dot
            HStack(spacing: 5) {
                Circle()
                    .fill(workoutManager.isSessionActive ? Color.green : Color.gray.opacity(0.4))
                    .frame(width: 6, height: 6)
                Text(workoutManager.isSessionActive ? "Streaming" : "Idle")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
            .animation(.easeInOut, value: workoutManager.isSessionActive)

            Spacer()

            // Start / Stop button
            Button {
                if workoutManager.isSessionActive {
                    workoutManager.stopSession()
                } else {
                    workoutManager.startSession()
                }
            } label: {
                Text(workoutManager.isSessionActive ? "Stop" : "Start")
                    .font(.system(size: 14, weight: .bold))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(workoutManager.isSessionActive ? .red : .purple)
        }
        .padding(.horizontal, 4)
        .navigationTitle("Focus")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await workoutManager.requestAuthorization()
        }
    }
}
