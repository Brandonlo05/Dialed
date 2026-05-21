/**
 * Phase 3: iOS ring buffer for lossy WatchConnectivity RR-interval packets.
 */

const RING_SIZE = 256;

export class RRIntervalRingBuffer {
  private buffer: number[] = new Array(RING_SIZE).fill(0);
  private head = 0;
  private count = 0;

  push(intervalMs: number): void {
    this.buffer[this.head] = intervalMs;
    this.head = (this.head + 1) % RING_SIZE;
    if (this.count < RING_SIZE) this.count += 1;
  }

  pushBatch(intervals: number[]): void {
    for (const interval of intervals) {
      this.push(interval);
    }
  }

  latest(count = 32): number[] {
    const n = Math.min(count, this.count);
    const out: number[] = [];
    let idx = (this.head - 1 + RING_SIZE) % RING_SIZE;
    for (let i = 0; i < n; i += 1) {
      out.unshift(this.buffer[idx]);
      idx = (idx - 1 + RING_SIZE) % RING_SIZE;
    }
    return out;
  }

  averageBpm(): number | null {
    const samples = this.latest(64).filter((v) => v > 0);
    if (samples.length === 0) return null;
    const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
    return 60000 / avgMs;
  }
}

export const rrBuffer = new RRIntervalRingBuffer();
