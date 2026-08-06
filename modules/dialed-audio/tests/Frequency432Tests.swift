//
//  Frequency432Tests.swift
//  DialedAudio — Golden Frequency spectral verification
//
//  NOTE: The generated Xcode project has no test target yet. This file lives
//  in modules/dialed-audio/tests/ (deliberately OUTSIDE the podspec's ios/
//  source glob so it never compiles into the app binary). To run it, add a
//  unit-test target in Xcode and include this file plus AudioEngineManager's
//  render constants. The same algorithm is verified executably today by the
//  Node Goertzel harness in the repo's verification suite.
//
//  Verifies: the phase-accumulated synthesis used by AudioEngineManager
//  places its peak spectral density at exactly 432.0 Hz (±0.1 Hz), with
//  Pythagorean partials present at 108 / 216 / 864 Hz.
//

import Accelerate
import AVFoundation
import XCTest

final class Frequency432Tests: XCTestCase {

  private let sampleRate = 48_000.0
  private let fundamental = 432.0
  private let overtoneGain: Float = 0.35

  /// Renders N samples using the exact algorithm shipped in
  /// AudioEngineManager's binaural source node (carrier path + overtone
  /// stack, beatHz = 0, AM disabled).
  private func renderGolden(frames: Int) -> [Float] {
    let twoPi = 2.0 * Double.pi
    var phase = 0.0
    var otHalf = 0.0, otQuart = 0.0, otOct = 0.0
    let inc = fundamental * twoPi / sampleRate
    let inc2 = (fundamental / 2) * twoPi / sampleRate
    let inc4 = (fundamental / 4) * twoPi / sampleRate
    let incO = (fundamental * 2) * twoPi / sampleRate
    let norm: Float = 1.0 / (1.0 + 0.8 * overtoneGain)

    var out = [Float](repeating: 0, count: frames)
    for i in 0..<frames {
      var s = Float(sin(phase))
      let stack = (0.4 * Float(sin(otHalf))
                 + 0.25 * Float(sin(otQuart))
                 + 0.15 * Float(sin(otOct))) * overtoneGain
      s = (s + stack) * norm
      out[i] = s
      phase += inc;  if phase >= twoPi { phase -= twoPi }
      otHalf += inc2;  if otHalf >= twoPi { otHalf -= twoPi }
      otQuart += inc4; if otQuart >= twoPi { otQuart -= twoPi }
      otOct += incO;   if otOct >= twoPi { otOct -= twoPi }
    }
    return out
  }

  /// vDSP FFT magnitude spectrum with a Hann window.
  private func spectrum(_ samples: [Float]) -> (mags: [Float], binHz: Double) {
    let log2n = vDSP_Length(log2(Double(samples.count)))
    let n = 1 << Int(log2n)
    var windowed = [Float](repeating: 0, count: n)
    var window = [Float](repeating: 0, count: n)
    vDSP_hann_window(&window, vDSP_Length(n), Int32(vDSP_HANN_NORM))
    vDSP_vmul(samples, 1, window, 1, &windowed, 1, vDSP_Length(n))

    var real = [Float](repeating: 0, count: n / 2)
    var imag = [Float](repeating: 0, count: n / 2)
    var mags = [Float](repeating: 0, count: n / 2)
    real.withUnsafeMutableBufferPointer { rp in
      imag.withUnsafeMutableBufferPointer { ip in
        var split = DSPSplitComplex(realp: rp.baseAddress!, imagp: ip.baseAddress!)
        windowed.withUnsafeBytes { raw in
          vDSP_ctoz(raw.bindMemory(to: DSPComplex.self).baseAddress!, 2, &split, 1, vDSP_Length(n / 2))
        }
        let setup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2))!
        defer { vDSP_destroy_fftsetup(setup) }
        vDSP_fft_zrip(setup, &split, 1, log2n, FFTDirection(FFT_FORWARD))
        vDSP_zvabs(&split, 1, &mags, 1, vDSP_Length(n / 2))
      }
    }
    return (mags, sampleRate / Double(n))
  }

  /// Parabolic interpolation around the peak bin for sub-bin frequency.
  private func peakFrequency(_ mags: [Float], binHz: Double, searchLo: Double, searchHi: Double) -> Double {
    let lo = Int(searchLo / binHz), hi = Int(searchHi / binHz)
    var k = lo
    for i in lo...hi where mags[i] > mags[k] { k = i }
    let a = Double(mags[k - 1]), b = Double(mags[k]), c = Double(mags[k + 1])
    let delta = 0.5 * (a - c) / (a - 2 * b + c)
    return (Double(k) + delta) * binHz
  }

  func testPeakSpectralDensityIs432() {
    // 2^21 samples @ 48 kHz ≈ 43.7 s → bin width ≈ 0.0229 Hz
    let samples = renderGolden(frames: 1 << 21)
    let (mags, binHz) = spectrum(samples)
    let peak = peakFrequency(mags, binHz: binHz, searchLo: 400, searchHi: 460)
    XCTAssertEqual(peak, 432.0, accuracy: 0.1,
                   "Fundamental must sit at 432.0 ± 0.1 Hz (measured \(peak))")
  }

  func testPythagoreanPartialsPresent() {
    let samples = renderGolden(frames: 1 << 21)
    let (mags, binHz) = spectrum(samples)
    for target in [108.0, 216.0, 864.0] {
      let bin = Int(target / binHz)
      let neighborhood = Int(20.0 / binHz)
      let local = Array(mags[(bin - neighborhood)...(bin + neighborhood)])
      let floorRef = mags[Int((target + 40.0) / binHz)]
      XCTAssertGreaterThan(local.max()!, floorRef * 20,
                           "Partial at \(target) Hz must rise ≥26 dB above the local floor")
    }
  }
}
