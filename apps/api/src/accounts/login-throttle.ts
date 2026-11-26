/**
 * Slows down password guessing: at most `maxFailures` wrong passwords per email within
 * `windowMs`. In memory, like the rooms (Redis would share it across servers later).
 */
export class LoginThrottle {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 60_000,
  ) {}

  isBlocked(key: string, now: number): boolean {
    return this.recent(key, now).length >= this.maxFailures;
  }

  recordFailure(key: string, now: number): void {
    this.failures.set(key, [...this.recent(key, now), now]);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private recent(key: string, now: number): number[] {
    const recent = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length === 0) this.failures.delete(key);
    return recent;
  }
}
