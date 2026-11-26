import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useCountdown } from './useCountdown';

/** Runs the composable inside an effect scope (as a component would) and returns it. */
function inScope<T>(run: () => T): { result: T; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(run);
  if (result === undefined) throw new Error('scope did not run');
  return { result, stop: () => scope.stop() };
}

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });
  afterEach(() => vi.useRealTimers());

  it('counts down to the server deadline', () => {
    const endsAt = ref<number | null>(15_000);
    const { result, stop } = inScope(() => useCountdown(endsAt));
    const { seconds } = result;
    expect(seconds.value).toBe(5);
    vi.advanceTimersByTime(2_500);
    expect(seconds.value).toBe(3);
    vi.advanceTimersByTime(10_000);
    expect(seconds.value).toBe(0);
    stop();
  });

  it('corrects a client clock that is behind the server', () => {
    // Server is 3 s ahead of this browser: only 2 s are really left.
    const { result, stop } = inScope(() => useCountdown(15_000, 3_000));
    const { seconds } = result;
    expect(seconds.value).toBe(2);
    stop();
  });

  it('is null without a deadline', () => {
    const { result, stop } = inScope(() => useCountdown(null));
    const { seconds } = result;
    expect(seconds.value).toBeNull();
    stop();
  });
});
