<script setup lang="ts">
/**
 * Quick match waiting screen: elapsed time, Cancel, and after 30 s an offer to play Minebot
 * instead, so a lone visitor is never stuck waiting.
 */
import { QUICK_MATCH_BOT_OFFER_MS } from '@minefall/shared';
import { computed, onScopeDispose, ref } from 'vue';
import { formatDuration } from '../lib/format';

const emit = defineEmits<{ cancel: []; playBot: [] }>();

const startedAt = Date.now();
const elapsedMs = ref(0);
const timer = setInterval(() => (elapsedMs.value = Date.now() - startedAt), 250);
onScopeDispose(() => clearInterval(timer));

const offerBot = computed(() => elapsedMs.value >= QUICK_MATCH_BOT_OFFER_MS);
</script>

<template>
  <div class="space-y-4 text-center" role="status" aria-live="polite" data-testid="quick-match">
    <div class="flex items-center justify-center gap-3">
      <span class="relative flex size-3">
        <span class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
        <span class="relative inline-flex size-3 rounded-full bg-emerald-400" />
      </span>
      <p class="font-semibold">Searching for an opponent…</p>
      <span class="font-mono text-sm text-muted tabular-nums">{{ formatDuration(elapsedMs) }}</span>
    </div>

    <div v-if="offerBot" class="animate-pop space-y-2 rounded-xl bg-surface-2 p-3">
      <p class="text-sm">Nobody yet. Want to play against Minebot 🤖 meanwhile?</p>
      <button
        type="button"
        class="w-full rounded-xl bg-mine py-2.5 font-bold text-night hover:brightness-110"
        data-testid="quick-match-bot"
        @click="emit('playBot')"
      >
        Play Minebot instead
      </button>
    </div>

    <button
      type="button"
      class="text-sm text-muted underline-offset-4 hover:underline"
      data-testid="quick-match-cancel"
      @click="emit('cancel')"
    >
      Cancel
    </button>
  </div>
</template>
