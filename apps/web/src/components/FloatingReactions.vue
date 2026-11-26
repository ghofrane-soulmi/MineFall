<script setup lang="ts">
/** Emoji reactions floating up over the board for 2 s (SPEC section 7). */
import type { Reaction } from '../stores/game';

defineProps<{ reactions: readonly Reaction[]; myId: string | null }>();

/** Spread reactions horizontally from their id so two at once do not overlap. */
function leftFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  return `${15 + (hash % 70)}%`;
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
    <span
      v-for="r in reactions"
      :key="r.id"
      class="absolute bottom-[10%] animate-float-up text-5xl drop-shadow-lg"
      :style="{ left: leftFor(r.id) }"
    >
      {{ r.emoji }}
    </span>
  </div>
</template>
