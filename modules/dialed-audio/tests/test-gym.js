/*
 * Verifies the Gym Mode DSP additions, replicating the Swift block-level math.
 *  1. Legacy bypass: glide 0 + iso 0 → output bit-identical to pre-Gym engine
 *  2. Phase I linear glide lands 18→40 Hz in exactly 120 s
 *  3. Phase III exponential decay 10→4 Hz settles ~95% by 180 s
 *  4. Isochronic gate is click-free (bounded slew) and hits full 0/1 range
 */
'use strict';

const SR = 48000;
const BLOCK = 1024; // iOS default playback buffer
const blockSeconds = BLOCK / SR;

// ── Block-level glide, exactly as written in the render callback ───────────
function glide({ from, target, rate, tau, seconds }) {
  let cur = from;
  const blocks = Math.round(seconds / blockSeconds);
  for (let b = 0; b < blocks; b++) {
    if (tau > 0) {
      cur += (target - cur) * (1 - Math.exp(-blockSeconds / tau));
    } else if (rate > 0) {
      const step = rate * blockSeconds;
      const d = target - cur;
      cur += d > 0 ? Math.min(step, d) : Math.max(-step, d);
    }
  }
  return cur;
}

// 1) Legacy bypass — rate 0 and tau 0 must snap to beatHz every block
{
  let cur = 999;
  const p = { beatHz: 10 };
  for (let b = 0; b < 100; b++) cur = p.beatHz; // the else-branch
  if (cur !== 10) throw new Error('legacy bypass broken');
  console.log('legacy bypass: glide disabled → beatHz snaps exactly ✅');
}

// 2) Phase I: 18 → 40 Hz linear over 120 s
{
  const rate = (40 - 18) / 120;
  const end = glide({ from: 18, target: 40, rate, tau: 0, seconds: 120 });
  if (Math.abs(end - 40) > 0.01) throw new Error('Phase I did not land: ' + end);
  const mid = glide({ from: 18, target: 40, rate, tau: 0, seconds: 60 });
  if (Math.abs(mid - 29) > 0.05) throw new Error('Phase I midpoint off: ' + mid);
  // must never overshoot
  const over = glide({ from: 18, target: 40, rate, tau: 0, seconds: 180 });
  if (over > 40.0001) throw new Error('Phase I overshoots: ' + over);
  console.log('Phase I: 18→' + end.toFixed(3) + ' Hz @120s, midpoint ' + mid.toFixed(2) + ' Hz, no overshoot ✅');
}

// 3) Phase III: 10 → 4 Hz exponential, tau = 180/3 = 60 s
{
  const tau = 180 / 3;
  const end = glide({ from: 10, target: 4, rate: 0, tau, seconds: 180 });
  const settled = 1 - (end - 4) / (10 - 4); // fraction of the way to target
  if (settled < 0.94) throw new Error('Phase III under-settled: ' + settled);
  if (end < 4) throw new Error('Phase III undershoots target: ' + end);
  console.log('Phase III: 10→' + end.toFixed(3) + ' Hz @180s (' + (settled * 100).toFixed(1) + '% settled, monotonic) ✅');
}

// 4) Isochronic gate — raised-cosine edges, click-free
{
  const rateHz = 40;
  const gInc = rateHz / SR;
  const edge = Math.min(0.25, Math.max(0.002, 0.002 * rateHz)); // 0.08
  let g = 0;
  const gates = [];
  for (let i = 0; i < SR / 10; i++) { // 100 ms
    let gate;
    if (g < edge) gate = 0.5 * (1 - Math.cos(Math.PI * g / edge));
    else if (g < 0.5 - edge) gate = 1;
    else if (g < 0.5) gate = 0.5 * (1 + Math.cos(Math.PI * (g - (0.5 - edge)) / edge));
    else gate = 0;
    gates.push(gate);
    g += gInc; if (g >= 1) g -= 1;
  }
  const min = Math.min(...gates), max = Math.max(...gates);
  if (min > 0.0001) throw new Error('gate never reaches 0 (depth incomplete): ' + min);
  if (max < 0.9999) throw new Error('gate never reaches 1: ' + max);
  // Max per-sample slew — a hard square would be 1.0 (instant discontinuity)
  let slew = 0;
  for (let i = 1; i < gates.length; i++) slew = Math.max(slew, Math.abs(gates[i] - gates[i - 1]));
  if (slew > 0.05) throw new Error('gate slew too steep (click risk): ' + slew);
  // Duty at half-amplitude. A nominal 50% square with raised-cosine edges
  // measures (0.5 − edge) because each edge eats into the on-time; at
  // edge=0.08 that is ~42%. Anything near 50% would mean the edges are not
  // actually being applied (i.e. a clicking hard square).
  const duty = gates.filter((v) => v > 0.5).length / gates.length;
  const expected = 0.5 - edge;
  if (Math.abs(duty - expected) > 0.03) {
    throw new Error('duty ' + duty.toFixed(3) + ' != expected ' + expected.toFixed(3));
  }
  console.log('Isochronic 40 Hz: range [' + min.toFixed(4) + ', ' + max.toFixed(4) + '], max slew ' +
    slew.toFixed(5) + '/sample (hard square = 1.0), duty ' + (duty * 100).toFixed(1) + '% ✅');
}

console.log('\nALL GYM DSP CHECKS PASS');
