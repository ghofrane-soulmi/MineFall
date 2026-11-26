<script setup lang="ts">
/** End-of-game card shown over the board: result, stats, Rematch / View board / Home. */
import type { RoomPlayerInfo } from '@minefall/shared';
import { computed } from 'vue';
import { formatDuration } from '../lib/format';
import type { EndSummary } from '../stores/game';

const props = defineProps<{
  summary: EndSummary;
  players: readonly RoomPlayerInfo[];
  myId: string | null;
}>();
const emit = defineEmits<{ rematch: []; home: []; viewBoard: [] }>();

const me = computed(() => props.players.find((p) => p.id === props.myId));
const opponent = computed(() => props.players.find((p) => p.id !== props.myId));

const title = computed(() => {
  const { result } = props.summary;
  if (result.type === 'draw') return 'Draw!';
  return result.winnerId === props.myId ? 'You win!' : 'You lose';
});

const subtitle = computed(() => {
  const { result } = props.summary;
  if (result.type === 'draw') return 'No more moves left.';
  if (result.type === 'forfeit') {
    return result.winnerId === props.myId
      ? `${opponent.value?.nickname ?? 'Your opponent'} left the game.`
      : 'You left or stayed disconnected too long.';
  }
  return 'Four in a row.';
});

/** Explosions, not mines: one explosion on a shared cell removes two mines. */
const exploded = computed(() => new Set(props.summary.explodedMines.map((m) => m.moveNumber)).size);
</script>

<template>
  <div
    class="absolute inset-0 z-40 grid place-items-center rounded-2xl bg-night/70 p-4 backdrop-blur-[2px]"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    data-testid="end-overlay"
  >
    <div
      class="w-full max-w-xs animate-pop rounded-2xl border border-line bg-surface p-6 text-center shadow-2xl"
    >
      <h2 class="text-3xl font-black tracking-tight" data-testid="end-title">{{ title }}</h2>
      <p class="mt-1 text-sm text-muted">{{ subtitle }}</p>

      <dl class="my-5 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-surface-2 p-2">
          <dt class="text-[11px] text-muted">Moves</dt>
          <dd class="font-mono font-bold">{{ summary.moveCount }}</dd>
        </div>
        <div class="rounded-lg bg-surface-2 p-2">
          <dt class="text-[11px] text-muted">Time</dt>
          <dd class="font-mono font-bold">
            {{ summary.durationMs === null ? '–' : formatDuration(summary.durationMs) }}
          </dd>
        </div>
        <div class="rounded-lg bg-surface-2 p-2">
          <dt class="text-[11px] text-muted">Booms</dt>
          <dd class="font-mono font-bold">{{ exploded }}</dd>
        </div>
      </dl>

      <div class="space-y-2">
        <button
          type="button"
          class="w-full rounded-xl bg-mine py-2.5 font-bold text-night transition hover:brightness-110 disabled:opacity-50"
          :disabled="me?.wantsRematch || players.length < 2"
          data-testid="rematch"
          @click="emit('rematch')"
        >
          {{
            me?.wantsRematch
              ? 'Waiting for opponent…'
              : opponent?.bot
                ? 'Play again'
                : opponent?.wantsRematch
                  ? 'Accept rematch'
                  : 'Rematch'
          }}
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-xl bg-surface-2 py-2 text-sm font-semibold hover:bg-line"
            @click="emit('viewBoard')"
          >
            View board
          </button>
          <button
            type="button"
            class="rounded-xl bg-surface-2 py-2 text-sm font-semibold hover:bg-line"
            @click="emit('home')"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
