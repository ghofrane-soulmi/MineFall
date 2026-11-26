<script setup lang="ts">
/**
 * The in-game screen (placement, playing, finished): players + timer, the board, chat,
 * dice and end overlays. Pure presentation over the game store.
 */
import {
  MINES_PER_PLAYER,
  PLACEMENT_DURATION_MS,
  TURN_DURATION_MS,
  type Cell,
  type ChatMessageType,
  type PlayerId,
} from '@minefall/shared';
import { computed, ref, watch } from 'vue';
import { useGameStore } from '../stores/game';
import ChatPanel from './ChatPanel.vue';
import CountdownBar from './CountdownBar.vue';
import DiceRoll from './DiceRoll.vue';
import EndOverlay from './EndOverlay.vue';
import FloatingReactions from './FloatingReactions.vue';
import GameBoard from './board/GameBoard.vue';
import PlayerCard from './PlayerCard.vue';

const emit = defineEmits<{ leave: [] }>();
const store = useGameStore();

const pendingMines = ref<Cell[]>([]);
const showEnd = ref(true);
const chatOpen = ref(false);

const game = computed(() => store.game);
const phase = computed(() => store.phase);
const opponentName = computed(() => store.opponent?.nickname ?? 'Your opponent');

const mode = computed<'placement' | 'play' | 'view'>(() => {
  if (phase.value === 'placement' && !store.myMinesConfirmed) return 'placement';
  if (phase.value === 'playing' && store.isMyTurn) return 'play';
  return 'view';
});

const winningLine = computed(() =>
  game.value?.result?.type === 'win' ? game.value.result.winningLine : null,
);

function colorOf(playerId: PlayerId) {
  return game.value?.players.find((p) => p.id === playerId)?.color ?? null;
}
function nameOf(playerId: PlayerId): string {
  return playerId === store.myId
    ? 'You'
    : (store.players.find((p) => p.id === playerId)?.nickname ?? '?');
}
function graceFor(playerId: PlayerId): number | null {
  return store.room?.disconnected.find((d) => d.playerId === playerId)?.graceEndsAt ?? null;
}

// --- Placement -------------------------------------------------------------------------
function toggleCell(cell: Cell): void {
  const index = pendingMines.value.findIndex((c) => c.col === cell.col && c.row === cell.row);
  if (index >= 0) {
    pendingMines.value.splice(index, 1);
  } else if (pendingMines.value.length < MINES_PER_PLAYER) {
    pendingMines.value.push(cell);
  } else {
    pendingMines.value = [...pendingMines.value.slice(1), cell]; // replace the oldest pick
  }
}

async function confirmMines(): Promise<void> {
  await store.placeMines(pendingMines.value);
}

// A new game (first one or rematch) resets local choices and re-shows the end card later.
watch(phase, (next) => {
  if (next === 'placement') pendingMines.value = [];
  if (next === 'finished') showEnd.value = true;
});

// --- Status line + screen reader announcements ----------------------------------------
const status = computed(() => {
  if (phase.value === 'placement') {
    if (!store.myMinesConfirmed) {
      return `Hide your ${MINES_PER_PLAYER} mines (${pendingMines.value.length}/${MINES_PER_PLAYER}). Not on the top row.`;
    }
    const opponentDone = game.value?.minesConfirmed.find(
      (m) => m.playerId !== store.myId,
    )?.confirmed;
    return opponentDone ? 'Starting…' : `${opponentName.value} is hiding their mines…`;
  }
  if (phase.value === 'playing') {
    return store.isMyTurn ? 'Your turn: pick a column' : `${opponentName.value} is thinking…`;
  }
  return 'Game over';
});

const announcement = computed(() => {
  const move = store.lastMove;
  if (!move) return status.value;
  const who = nameOf(move.playerId);
  const what =
    move.outcome === 'exploded'
      ? `Boom! ${who} hit a mine in column ${move.column + 1}. That column is blocked for one turn.`
      : `${who} dropped a token in column ${move.column + 1}${move.timeout ? ' (time ran out)' : ''}.`;
  return `${what} ${status.value}`;
});

const timerLabel = computed(() =>
  phase.value === 'placement' ? 'Mine placement' : store.isMyTurn ? 'Your turn' : 'Their turn',
);
const timerTotal = computed(() =>
  phase.value === 'placement' ? PLACEMENT_DURATION_MS : TURN_DURATION_MS,
);

function sendChat(type: ChatMessageType, value: string): void {
  void store.sendChat(type, value);
}

function leave(): void {
  const running = phase.value === 'placement' || phase.value === 'playing';
  if (running && !window.confirm('Leaving now counts as a forfeit. Leave the game?')) return;
  emit('leave');
}
</script>

<template>
  <div v-if="game" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div class="min-w-0 space-y-3">
      <!-- Players + timer -->
      <div class="grid grid-cols-2 gap-2">
        <PlayerCard
          v-if="store.me"
          :player="store.me"
          is-me
          :is-turn="phase === 'playing' && game.currentPlayerId === store.myId"
          :badge="
            phase === 'placement'
              ? store.myMinesConfirmed
                ? 'Mines hidden ✓'
                : 'Hiding mines…'
              : null
          "
        />
        <PlayerCard
          v-if="store.opponent"
          :player="store.opponent"
          :is-me="false"
          :is-turn="phase === 'playing' && game.currentPlayerId === store.opponent.id"
          :grace-ends-at="graceFor(store.opponent.id)"
          :clock-offset="store.clockOffset"
          :badge="
            phase === 'placement'
              ? game.minesConfirmed.find((m) => m.playerId === store.opponent?.id)?.confirmed
                ? 'Mines hidden ✓'
                : 'Hiding mines…'
              : null
          "
        />
      </div>

      <CountdownBar
        v-if="phase === 'placement' || phase === 'playing'"
        :ends-at="store.room?.phaseEndsAt ?? null"
        :total-ms="timerTotal"
        :clock-offset="store.clockOffset"
        :label="timerLabel"
      />

      <p class="text-center font-semibold" data-testid="status">{{ status }}</p>
      <p class="sr-only" aria-live="polite">{{ announcement }}</p>

      <div class="relative">
        <GameBoard
          :board="game.board"
          :mode="mode"
          :my-color="store.myColor"
          :own-mines="game.ownMines"
          :pending-mines="pendingMines"
          :exploded-mines="game.explodedMines"
          :revealed-mines="game.revealedMines"
          :blocked-columns="game.blockedColumns"
          :winning-line="winningLine"
          :last-move="store.lastMove"
          :color-of="colorOf"
          @toggle-cell="toggleCell"
          @drop="store.dropToken($event)"
        />
        <FloatingReactions :reactions="store.reactions" :my-id="store.myId" />
        <EndOverlay
          v-if="phase === 'finished' && showEnd && store.summary"
          :summary="store.summary"
          :players="store.players"
          :my-id="store.myId"
          @rematch="store.requestRematch()"
          @home="emit('leave')"
          @view-board="showEnd = false"
        />
      </div>

      <!-- Contextual actions -->
      <div class="flex flex-wrap justify-center gap-2">
        <template v-if="mode === 'placement'">
          <button
            type="button"
            class="rounded-xl bg-mine px-6 py-2.5 font-bold text-night transition hover:brightness-110 disabled:opacity-40"
            :disabled="pendingMines.length !== MINES_PER_PLAYER"
            data-testid="confirm-mines"
            @click="confirmMines"
          >
            Confirm mines
          </button>
          <button
            type="button"
            class="rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-semibold hover:bg-line disabled:opacity-40"
            :disabled="pendingMines.length === 0"
            @click="pendingMines = []"
          >
            Clear
          </button>
        </template>
        <button
          v-if="phase === 'finished' && !showEnd"
          type="button"
          class="rounded-xl bg-mine px-6 py-2.5 font-bold text-night"
          @click="showEnd = true"
        >
          Show result
        </button>
        <button
          type="button"
          class="rounded-xl px-4 py-2.5 text-sm text-muted underline-offset-4 hover:underline"
          @click="leave"
        >
          Leave game
        </button>
      </div>
    </div>

    <!-- Chat: side panel on desktop, bottom sheet on mobile -->
    <aside class="hidden h-[640px] lg:block">
      <ChatPanel
        :messages="store.chat"
        :players="store.players"
        :my-id="store.myId"
        @send="sendChat"
      />
    </aside>
    <div class="lg:hidden">
      <button
        type="button"
        class="fixed right-4 bottom-4 z-30 rounded-full bg-mine px-5 py-3 font-bold text-night shadow-lg"
        :aria-expanded="chatOpen"
        @click="chatOpen = !chatOpen"
      >
        {{ chatOpen ? 'Close chat' : `Chat${store.chat.length ? ` (${store.chat.length})` : ''}` }}
      </button>
      <div v-if="chatOpen" class="fixed inset-x-0 bottom-0 z-20 h-[60vh] animate-pop p-2 pb-20">
        <ChatPanel
          :messages="store.chat"
          :players="store.players"
          :my-id="store.myId"
          @send="sendChat"
        />
      </div>
    </div>

    <DiceRoll
      v-if="store.dice"
      :roll="store.dice"
      :players="store.players"
      @done="store.dismissDice()"
    />
  </div>
</template>
