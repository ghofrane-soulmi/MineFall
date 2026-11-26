<script setup lang="ts">
/** Countdown bar for the placement phase or the current turn (display only). */
import { computed } from 'vue';
import { useCountdown } from '../composables/useCountdown';

const props = defineProps<{
  endsAt: number | null;
  totalMs: number;
  clockOffset: number;
  label: string;
}>();

const { remainingMs, seconds } = useCountdown(
  () => props.endsAt,
  () => props.clockOffset,
);
const fraction = computed(() =>
  remainingMs.value === null ? 0 : Math.min(1, remainingMs.value / props.totalMs),
);
const urgent = computed(() => seconds.value !== null && seconds.value <= 5);
</script>

<template>
  <div v-if="endsAt !== null" class="w-full" :aria-label="`${label}: ${seconds} seconds left`">
    <div class="mb-1 flex justify-between text-xs text-muted">
      <span>{{ label }}</span>
      <span class="font-mono tabular-nums" :class="urgent && 'font-bold text-red-token'">
        {{ seconds }}s
      </span>
    </div>
    <div class="h-1.5 overflow-hidden rounded-full bg-surface-2">
      <div
        class="h-full rounded-full transition-[width] duration-100 ease-linear"
        :class="urgent ? 'bg-red-token' : 'bg-mine'"
        :style="{ width: `${fraction * 100}%` }"
      />
    </div>
  </div>
</template>
