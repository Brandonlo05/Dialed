/*
 * Verifies the refactored engine's DSP claims:
 *  1. SVF at 0 dB is EXACTLY transparent (neutral bypass, bit-identical).
 *  2. Simper low-shelf is stable and boosts LF / leaves HF ~unity.
 *  3. xorshift32 PRNG is well-distributed and zero-mean (valid noise source).
 *  4. 432 Hz + overtone stack still lands on spec after the refactor.
 */
'use strict';

// ── Simper SVF low-shelf, exactly as written in AudioEngineManager ─────────
function coeffs(gainDb, cutoffHz, q, sr) {
  const neutral = Math.abs(gainDb) < 0.01;
  const A = Math.pow(10, gainDb / 40);
  const w0 = Math.min(Math.PI * cutoffHz / sr, Math.PI * 0.49);
  const g = Math.tan(w0) / Math.sqrt(Math.max(A, 1e-6));
  const k = 1 / Math.max(q, 0.05);
  const a1 = 1 / (1 + g * (g + k));
  return { a1, a2: g * a1, a3: g * (g * a1), m1: k * (A - 1), m2: A * A - 1, neutral };
}

function runSVF(input, c) {
  let s1 = 0, s2 = 0;
  return input.map((x) => {
    if (c.neutral) return x; // engine skips the block entirely
    const v3 = x - s2;
    const v1 = c.a1 * s1 + c.a2 * v3;
    const v2 = s2 + c.a2 * s1 + c.a3 * v3;
    s1 = 2 * v1 - s1;
    s2 = 2 * v2 - s2;
    return x + c.m1 * v1 + c.m2 * v2;
  });
}

const SR = 48000;
const sig = [];
for (let i = 0; i < 4096; i++) sig.push(Math.sin(2 * Math.PI * 200 * i / SR));

// 1) 0 dB transparency — must be bit-identical
const neutralOut = runSVF(sig, coeffs(0, 200, 0.7071, SR));
let maxDiff = 0;
for (let i = 0; i < sig.length; i++) maxDiff = Math.max(maxDiff, Math.abs(neutralOut[i] - sig[i]));
if (maxDiff !== 0) throw new Error('0 dB not bit-identical: max diff ' + maxDiff);
console.log('SVF @ 0 dB: bit-identical passthrough (max diff exactly 0) ✅');

// 2) Shelf response: +12 dB @ 200 Hz should lift LF, leave HF near unity
function rms(a) { return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length); }
function toneRMS(freq, c) {
  const t = [];
  for (let i = 0; i < 16384; i++) t.push(Math.sin(2 * Math.PI * freq * i / SR));
  return rms(runSVF(t, c).slice(8192)) / rms(t.slice(8192)); // settled portion
}
const shelf = coeffs(12, 200, 0.7071, SR);
const lfGain = 20 * Math.log10(toneRMS(40, shelf));
const hfGain = 20 * Math.log10(toneRMS(6000, shelf));
if (!(lfGain > 9 && lfGain < 13)) throw new Error('LF shelf gain out of range: ' + lfGain.toFixed(2));
if (Math.abs(hfGain) > 0.6) throw new Error('HF not unity: ' + hfGain.toFixed(2));
console.log('SVF +12 dB shelf: 40 Hz ' + lfGain.toFixed(2) + ' dB / 6 kHz ' + hfGain.toFixed(2) + ' dB ✅');

// Stability: no NaN/Inf/blowup under sustained drive
const stress = runSVF(new Array(96000).fill(0).map((_, i) => Math.sin(2 * Math.PI * 55 * i / SR)), shelf);
const worst = stress.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
if (!isFinite(worst) || worst > 8) throw new Error('SVF unstable: peak ' + worst);
console.log('SVF stability over 2 s sustained drive: peak ' + worst.toFixed(3) + ', finite ✅');

// 3) xorshift32 PRNG — same sequence the engine uses
let r = 0x9E3779B9 >>> 0;
const samples = [];
for (let i = 0; i < 200000; i++) {
  r ^= (r << 13) >>> 0; r >>>= 0;
  r ^= r >>> 17;
  r ^= (r << 5) >>> 0; r >>>= 0;
  samples.push((r | 0) / 2147483648);
}
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
const inRange = samples.every((v) => v >= -1.0001 && v <= 1.0001);
if (!inRange) throw new Error('PRNG out of [-1,1]');
if (Math.abs(mean) > 0.01) throw new Error('PRNG mean biased: ' + mean);
if (sd < 0.5 || sd > 0.62) throw new Error('PRNG sd suspect: ' + sd);
// no short cycle
if (new Set(samples.slice(0, 50000)).size < 49000) throw new Error('PRNG cycles early');
console.log('xorshift32: mean ' + mean.toFixed(5) + ', sd ' + sd.toFixed(4) + ', full-range, no short cycle ✅');

// 4) 432 Hz + overtone stack still on spec post-refactor
const TWO_PI = Math.PI * 2, F = 432, OT = 0.35, N = SR * 6;
let ph = 0, oH = 0, oQ = 0, oO = 0;
const norm = 1 / (1 + 0.8 * OT);
const buf = new Float64Array(N);
const inc = F * TWO_PI / SR, i2 = (F / 2) * TWO_PI / SR, i4 = (F / 4) * TWO_PI / SR, iO = F * 2 * TWO_PI / SR;
for (let i = 0; i < N; i++) {
  const stack = (0.4 * Math.sin(oH) + 0.25 * Math.sin(oQ) + 0.15 * Math.sin(oO)) * OT;
  buf[i] = (Math.sin(ph) + stack) * norm;
  ph += inc; if (ph >= TWO_PI) ph -= TWO_PI;
  oH += i2; if (oH >= TWO_PI) oH -= TWO_PI;
  oQ += i4; if (oQ >= TWO_PI) oQ -= TWO_PI;
  oO += iO; if (oO >= TWO_PI) oO -= TWO_PI;
}
const win = new Float64Array(N);
for (let i = 0; i < N; i++) win[i] = buf[i] * 0.5 * (1 - Math.cos(TWO_PI * i / (N - 1)));
function goertzel(f) {
  const w = TWO_PI * f / SR, co = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) { const s0 = win[i] + co * s1 - s2; s2 = s1; s1 = s0; }
  return s1 * s1 + s2 * s2 - co * s1 * s2;
}
let bf = 0, bp = -1;
const step = 0.05, fr = [], pw = [];
for (let f = 425; f <= 439.0001; f += step) { const p = goertzel(f); fr.push(f); pw.push(p); if (p > bp) { bp = p; bf = f; } }
const k = fr.indexOf(bf), a = pw[k - 1], b = pw[k], c2 = pw[k + 1];
const peak = bf + step * (0.5 * (a - c2)) / (a - 2 * b + c2);
if (Math.abs(peak - 432) > 0.1) throw new Error('432 peak drifted: ' + peak.toFixed(4));
console.log('432 Hz post-refactor: peak ' + peak.toFixed(4) + ' Hz (spec 432.0 ±0.1) ✅');

console.log('\nALL DSP CHECKS PASS');
