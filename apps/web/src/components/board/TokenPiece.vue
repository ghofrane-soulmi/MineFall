<script setup lang="ts">
/**
 * One token. Colours also differ by an inner shape (ring vs diamond) for colour-blind players.
 * `dropRows` > 0 plays the gravity drop animation from that many rows above.
 */
import type { Color } from '@minefall/shared';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    color: Color;
    dropRows?: number;
    ghost?: boolean;
    winning?: boolean;
  }>(),
  { dropRows: 0, ghost: false, winning: false },
);

const style = computed(() =>
  props.dropRows > 0 ? { '--drop-from': `calc(-${props.dropRows} * 114%)` } : undefined,
);
</script>

<template>
  <div
    class="relative grid size-full place-items-center rounded-full"
    :class="[
      color === 'red'
        ? 'bg-red-token shadow-[inset_0_-6px_0_var(--color-red-token-dark)]'
        : 'bg-yellow-token shadow-[inset_0_-6px_0_var(--color-yellow-token-dark)]',
      ghost && 'opacity-40',
      dropRows > 0 && 'animate-drop',
      winning && 'animate-win z-10',
    ]"
    :style="style"
    aria-hidden="true"
    :data-testid="ghost ? undefined : `token-${color}`"
  >
    <!-- Shape marker for colour-blind players -->
    <svg viewBox="0 0 24 24" class="size-2/5 opacity-60">
      <circle
        v-if="color === 'red'"
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="var(--color-red-token-dark)"
        stroke-width="4"
      />
      <rect
        v-else
        x="5.5"
        y="5.5"
        width="13"
        height="13"
        transform="rotate(45 12 12)"
        fill="var(--color-yellow-token-dark)"
      />
    </svg>
  </div>
</template>
