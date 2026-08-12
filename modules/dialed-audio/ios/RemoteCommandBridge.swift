import AVFoundation
import Foundation
import MediaPlayer

/// Hands-free headphone gesture capture for Training Mode.
///
/// Maps hardware transport gestures to protocol phase advances:
///   • nextTrackCommand       — AirPods double-squeeze / XM5 swipe-forward
///   • togglePlayPauseCommand — AirPods single-squeeze / XM5 double-tap
///
/// IMPORTANT PLATFORM BEHAVIOUR
/// iOS routes headphone transport gestures to whichever process currently
/// owns the Now Playing slot. Populating MPNowPlayingInfoCenter is what
/// claims that slot — which means while Training Mode is armed, Dialed
/// takes headphone transport control AWAY from Spotify/Apple Music. The
/// user's double-tap advances a training phase instead of skipping a song.
/// That is the intended trade for hands-free operation mid-set, but it is a
/// trade, so arming is explicit (enable/disable) and teardown is total.
///
/// All work here is main-thread/UIKit-adjacent. Nothing in this file is
/// reachable from the audio render thread.
final class RemoteCommandBridge {
  static let shared = RemoteCommandBridge()

  /// Fired on the main queue when a hardware gesture requests a phase advance.
  var onAdvanceRequest: ((String) -> Void)?

  private var armed = false
  private var nextToken: Any?
  private var toggleToken: Any?
  private var startedAt = Date()

  private init() {}

  // MARK: – Arming

  func enable() {
    guard !armed else { return }
    armed = true
    startedAt = Date()

    let center = MPRemoteCommandCenter.shared()

    // Transport commands we intentionally claim
    center.nextTrackCommand.isEnabled = true
    nextToken = center.nextTrackCommand.addTarget { [weak self] _ in
      self?.fire("nextTrack")
      return .success
    }

    center.togglePlayPauseCommand.isEnabled = true
    toggleToken = center.togglePlayPauseCommand.addTarget { [weak self] _ in
      self?.fire("togglePlayPause")
      return .success
    }

    // Commands we explicitly refuse, so a stray gesture cannot strand the
    // protocol in a state the UI does not know about.
    center.previousTrackCommand.isEnabled = false
    center.playCommand.isEnabled = false
    center.pauseCommand.isEnabled = false
    center.stopCommand.isEnabled = false
  }

  func disable() {
    guard armed else { return }
    armed = false

    let center = MPRemoteCommandCenter.shared()
    if let t = nextToken { center.nextTrackCommand.removeTarget(t) }
    if let t = toggleToken { center.togglePlayPauseCommand.removeTarget(t) }
    nextToken = nil
    toggleToken = nil

    center.nextTrackCommand.isEnabled = false
    center.togglePlayPauseCommand.isEnabled = false
    // Hand the rest of the transport back to default iOS behaviour
    center.previousTrackCommand.isEnabled = true
    center.playCommand.isEnabled = true
    center.pauseCommand.isEnabled = true

    // Release the Now Playing slot so the user's music app reclaims it
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  private func fire(_ source: String) {
    DispatchQueue.main.async { [weak self] in
      self?.onAdvanceRequest?(source)
    }
  }

  // MARK: – Now Playing metadata

  /// Populate the Now Playing slot. Beyond the lock screen, this is what
  /// keeps an AVRCP control channel alive for third-party Bluetooth headsets
  /// (Sony XM5 and similar) — without live metadata those devices may not
  /// deliver transport gestures to the app at all.
  func updateNowPlaying(title: String, subtitle: String, elapsed: Double, duration: Double) {
    guard armed else { return }
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: title,
      MPMediaItemPropertyArtist: subtitle,
      MPMediaItemPropertyAlbumTitle: "Dialed · Training Mode",
      MPNowPlayingInfoPropertyPlaybackRate: 1.0,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: max(0, elapsed),
      MPNowPlayingInfoPropertyIsLiveStream: duration <= 0,
    ]
    if duration > 0 {
      info[MPMediaItemPropertyPlaybackDuration] = duration
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }
}
