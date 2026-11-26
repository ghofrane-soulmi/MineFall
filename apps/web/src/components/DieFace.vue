<script setup lang="ts">
/** A six-sided die drawn with CSS pips. While `rolling`, it shows random faces (cosmetic). */
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{ value: number; rolling: boolean }>();

/** Pip positions (3x3 grid, index 0-8) for each face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const shown = ref(props.value);
let timer: ReturnType<typeof setInterval> | null = null;

watch(
  () => props.rolling,
  (rolling) => {
    if (timer) clearInterval(timer);
    timer = null;
    if (rolling) {
      timer = setInterval(() => (shown.value = 1 + Math.floor(Math.random() * 6)), 80);
    } else {
      shown.value = props.value;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const pips = computed(() => new Set(PIPS[shown.value] ?? []));
</script>

<template>
  <div
    class="grid size-12 grid-cols-3 grid-rows-3 gap-0.5 rounded-xl bg-slate-100 p-2 shadow-[inset_0_-4px_0_#cbd5e1]"
    :class="rolling && 'animate-shake'"
    role="img"
    :aria-label="rolling ? 'rolling die' : `die showing ${value}`"
  >
    <span v-for="i in 9" :key="i" class="grid place-items-center">
      <span v-if="pips.has(i - 1)" class="size-2 rounded-full bg-night" />
    </span>
  </div>
</template>
