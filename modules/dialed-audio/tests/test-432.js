/*
 * Executable spectral verification of the Golden Frequency synthesis.
 * Bit-faithful JS replica of AudioEngineManager's shipped algorithm
 * (float64 phase accumulators, identical wrap + overtone weights + norm),
 * analyzed with Hann-windowed Goertzel across 400–460 Hz at 0.05 Hz steps,
 * parabolic-interpolated peak. Pass criteria mirror the XCTest deliverable.
 */
'use strict';

const SR = 48000;
const N = SR * 10; // 10 s
const F = 432.0;
const OT_GAIN = 0.35;
const TWO_PI = 2 * Math.PI;

// ── Render (exact engine algorithm, beat 0, AM off) ─────────────────────────
const buf = new Float64Array(N);
{
  let phase = 0, otH = 0, otQ = 0, otO = 0;
  const inc = (F * TWO_PI) / SR;
  const inc2 = ((F / 2) * TWO_PI) / SR;
  const inc4 = ((F / 4) * TWO_PI) / SR;
  const incO = ((F * 2) * TWO_PI) / SR;
  const norm = 1 / (1 + 0.8 * OT_GAIN);
  for (let i = 0; i < N; i++) {
    const stack = (0.4 * Math.sin(otH) + 0.25 * Math.sin(otQ) + 0.15 * Math.sin(otO)) * OT_GAIN;
    buf[i] = (Math.sin(phase) + stack) * norm;
    phase += inc; if (phase >= TWO_PI) phase -= TWO_PI;
    otH += inc2; if (otH >= TWO_PI) otH -= TWO_PI;
    otQ += inc4; if (otQ >= TWO_PI) otQ -= TWO_PI;
    otO += incO; if (otO >= TWO_PI) otO -= TWO_PI;
  }
}

// Hann window (applied once into a copy for analysis)
const win = new Float64Array(N);
for (let i = 0; i < N; i++) win[i] = buf[i] * 0.5 * (1 - Math.cos((TWO_PI * i) / (N - 1)));

// ── Goertzel power at an arbitrary frequency ────────────────────────────────
function goertzelPower(f) {
  const w = (TWO_PI * f) / SR;
  const coeff = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    s0 = win[i] + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

// ── 1) Peak search 400–460 Hz @ 0.05 Hz + parabolic refinement ─────────────
const STEP = 0.05;
let bestF = 0, bestP = -1;
const freqs = [], powers = [];
for (let f = 400; f <= 460.0001; f += STEP) {
  const p = goertzelPower(f);
  freqs.push(f); powers.push(p);
  if (p > bestP) { bestP = p; bestF = f; }
}
const k = freqs.indexOf(bestF);
const [a, b, c] = [powers[k - 1], powers[k], powers[k + 1]];
const peak = bestF + STEP * (0.5 * (a - c)) / (a - 2 * b + c);

if (Math.abs(peak - 432.0) > 0.1) throw new Error('peak off spec: ' + peak.toFixed(4) + ' Hz');
console.log('peak spectral density: ' + peak.toFixed(4) + ' Hz  (spec 432.0 ± 0.1) ✅');

// ── 2) Pythagorean partials present at 108 / 216 / 864 Hz ──────────────────
for (const target of [108, 216, 864]) {
  const at = goertzelPower(target);
  const off = goertzelPower(target + 37); // arbitrary off-harmonic reference
  const db = 10 * Math.log10(at / off);
  if (db < 26) throw new Error('partial ' + target + ' Hz only ' + db.toFixed(1) + ' dB above floor');
  console.log('partial ' + String(target).padStart(3) + ' Hz: +' + db.toFixed(1) + ' dB above off-harmonic floor ✅');
}

// ── 3) Cents math sanity: 432 vs 440 concert pitch ─────────────────────────
const cents = 1200 * Math.log2(432 / 440);
if (Math.abs(cents - -31.7667) > 0.001) throw new Error('cents math: ' + cents);
console.log('detune vs A440: ' + cents.toFixed(4) + ' cents (spec −31.766) ✅');

// ── 4) Crest-factor guard: normalized signal never clips ───────────────────
let maxAbs = 0;
for (let i = 0; i < N; i++) maxAbs = Math.max(maxAbs, Math.abs(buf[i]));
if (maxAbs > 1.0) throw new Error('clipping: peak sample ' + maxAbs);
console.log('peak sample amplitude: ' + maxAbs.toFixed(4) + ' (≤ 1.0, no clipping) ✅');

console.log('ALL 432 Hz SPECTRAL CHECKS PASS');
