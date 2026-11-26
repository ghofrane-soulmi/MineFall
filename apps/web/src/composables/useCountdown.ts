/**
 * Display-only countdown from a server deadline (`endsAt`, epoch ms on the SERVER clock).
 * `clockOffset` = serverTime - Date.now(), so a wrong local clock does not skew the timer.
 * The server ends the phase on its own; this only draws the remaining time.
 */
import { computed, onScopeDispose, ref, toValue, type MaybeRefOrGetter } from 'vue';

const TICK_MS = 100;

export function useCountdown(
  endsAt: MaybeRefOrGetter<number | null>,
  clockOffset: MaybeRefOrGetter<number> = 0,
) {
  const now = ref(Date.now());
  const timer = setInterval(() => {
    now.value = Date.now();
  }, TICK_MS);
  onScopeDispose(() => clearInterval(timer));

  const remainingMs = computed(() => {
    const deadline = toValue(endsAt);
    if (deadline === null) return null;
    return Math.max(0, deadline - (now.value + toValue(clockOffset)));
  });
  const seconds = computed(() =>
    remainingMs.value === null ? null : Math.ceil(remainingMs.value / 1000),
  );

  return { remainingMs, seconds };
}
