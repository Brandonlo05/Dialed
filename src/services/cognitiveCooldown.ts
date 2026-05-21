/**
 * Phase 5: Cognitive Cooldown fractionation state machine.
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

  subscribe(listener: CooldownListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  start(): void {
    this.enterPhase('work', this.config.workMinutes * 60 * 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.phase = 'idle';
    this.emit();
  }

  private enterPhase(phase: CooldownPhase, durationMs: number): void {
    this.phase = phase;
    this.remainingMs = durationMs;
    this.emit();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.remainingMs -= 1000;
      if (this.remainingMs <= 0) {
        this.advance();
      } else {
        this.emit();
      }
    }, 1000);
  }

  private advance(): void {
    switch (this.phase) {
      case 'work':
        this.enterPhase('micro-break', this.config.microBreakSeconds * 1000);
        break;
      case 'micro-break':
        this.enterPhase('recovery', this.config.recoveryMinutes * 60 * 1000);
        break;
      case 'recovery':
      default:
        this.stop();
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.phase, this.remainingMs);
    }
  }

  getPhase(): CooldownPhase {
    return this.phase;
  }
}
