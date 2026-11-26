/**
 * Server-side timers, keyed by name ("K7QX2M:phase") so a new timer replaces the old one.
 * NestJS concept: an abstract class can be an injection token, like binding an interface to
 * an implementation in Laravel's container; unit tests bind a manual fake instead.
 */
import { Injectable, type OnModuleDestroy } from '@nestjs/common';

export abstract class Scheduler {
  /** Runs `task` after `delayMs`, replacing any timer with the same key. */
  abstract schedule(key: string, delayMs: number, task: () => void): void;
  abstract cancel(key: string): void;
  abstract cancelByPrefix(prefix: string): void;
}

@Injectable()
export class TimeoutScheduler extends Scheduler implements OnModuleDestroy {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  schedule(key: string, delayMs: number, task: () => void): void {
    this.cancel(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      task();
    }, delayMs);
    this.timers.set(key, timer);
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
  }

  cancelByPrefix(prefix: string): void {
    for (const key of [...this.timers.keys()]) {
      if (key.startsWith(prefix)) this.cancel(key);
    }
  }

  /** NestJS lifecycle hook: called on app shutdown, so no timer outlives the server. */
  onModuleDestroy(): void {
    for (const key of [...this.timers.keys()]) this.cancel(key);
  }
}
