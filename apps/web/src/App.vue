<script setup lang="ts">
import { watch } from 'vue';
import { useGameStore } from './stores/game';

const store = useGameStore();

// Error toasts disappear on their own.
let timer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => store.error,
  (message) => {
    if (timer) clearTimeout(timer);
    if (message) timer = setTimeout(() => store.clearError(), 3500);
  },
);
</script>

<template>
  <div class="min-h-screen px-4 pb-24 sm:px-6">
    <nav class="mx-auto flex max-w-6xl items-center justify-between py-4">
      <RouterLink to="/" class="text-xl font-black tracking-tight">
        Mine<span class="text-mine">fall</span>
      </RouterLink>
      <span
        v-if="store.connection === 'offline'"
        class="rounded-full bg-red-token/20 px-3 py-1 text-xs font-semibold text-red-token"
        role="status"
      >
        Reconnecting…
      </span>
    </nav>

    <main class="mx-auto max-w-6xl">
      <RouterView />
    </main>

    <div
      v-if="store.error"
      class="fixed inset-x-0 top-4 z-[60] mx-auto w-fit max-w-[90vw] animate-pop rounded-xl border border-red-token/40 bg-surface px-4 py-2 text-sm shadow-xl"
      role="alert"
      data-testid="toast"
    >
      {{ store.error }}
    </div>
  </div>
</template>
