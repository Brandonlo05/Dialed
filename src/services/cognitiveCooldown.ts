/**
 * Phase 5: Cognitive Cooldown fractionation state machine.
 *
 * Fractionation cycle: work → micro-break → recovery → idle
 * Default timing: 25 min work / 90 s micro-break / 5 min recovery (Pomodoro-derived).
 * Listeners receive (phase, remainingMs) on every tick and on phase transitions.
 */

export type CooldownPhase = 'work' | 'micro-break' | 'recovery' | 'idle';

export type CooldownConfig = {
  workMinutes: number;
  microBreakSeconds: number;
  recoveryMinutes: number;
};

const DEFAULT_CONFIG: CooldownConfig = {
  workMinutes: 25,
  microBreakSeconds: 90,
  recoveryMinutes: 5,
};

type CooldownListener = (phase: CooldownPhase, remainingMs: number) => void;

export class CognitiveCooldownMachine {
  private phase: CooldownPhase = 'idle';
  private timer: ReturnType<typeof setInterval> | null = null;
  private remainingMs = 0;
  private listeners: CooldownListener[] = [];

  constructor(private config: CooldownConfig = DEFAULT_CONFIG) {}

  // ── Public API ────────────────────────────────────────────────────────────

  subscribe(listener: CooldownListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  start(): void {
    this.enterPhase('work', this.config.workMinutes * 60_000);
  }

  stop(): void {
    this.clearTimer();
    this.phase = 'idle';
    this.remainingMs = 0;
    this.emit();
  }

  /** Restart the work phase from scratch without changing config. */
  reset(): void {
    this.stop();
    this.start();
  }

  /** Remove all listeners and stop the timer. Call when the component unmounts. */
  destroy(): void {
    this.clearTimer();
    this.phase = 'idle';
    this.remainingMs = 0;
    this.listeners = [];
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  getTimeRemaining(): number {
    return this.remainingMs;
  }

  getPhase(): CooldownPhase {
    return this.phase;
  }

  getConfig(): CooldownConfig {
    return { ...this.config };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private enterPhase(phase: CooldownPhase, durationMs: number): void {
    this.clearTimer();
    this.phase = phase;
    this.remainingMs = durationMs;
    this.emit();

    this.timer = setInterval(() => {
      this.remainingMs -= 1_000;
      if (this.remainingMs <= 0) {
        this.advance();
      } else {
        this.emit();
      }
    }, 1_000);
  }

  private advance(): void {
    switch (this.phase) {
      case 'work':
        this.enterPhase('micro-break', this.config.microBreakSeconds * 1_000);
        break;
      case 'micro-break':
        this.enterPhase('recovery', this.config.recoveryMinutes * 60_000);
        break;
      case 'recovery':
      default:
        this.stop();
        break;
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.phase, this.remainingMs);
    }
  }
}

export const cooldownMachine = new CognitiveCooldownMachine();
