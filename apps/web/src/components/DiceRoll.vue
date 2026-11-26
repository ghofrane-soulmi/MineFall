<script setup lang="ts">
/**
 * Replays the server's dice roll (who starts). Every round comes from the server; the client
 * only animates it: roll ~0.9 s, show the totals, "tie" -> next round, then the winner.
 */
import type { RoomPlayerInfo, StartingRoll } from '@minefall/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import DieFace from './DieFace.vue';

const props = defineProps<{
  roll: StartingRoll;
  /** Players in the order the server rolled them (room members order). */
  players: readonly RoomPlayerInfo[];
}>();
const emit = defineEmits<{ done: [] }>();

const ROLL_MS = 900;
const SHOW_MS = 1100;
const FINAL_MS = 1600;

const roundIndex = ref(0);
const rolling = ref(true);
const timers: ReturnType<typeof setTimeout>[] = [];

const round = computed(() => props.roll.rounds[roundIndex.value]);
const isLast = computed(() => roundIndex.value === props.roll.rounds.length - 1);
const winner = computed(() => props.players.find((p) => p.id === props.roll.firstPlayerId));

function playRound(): void {
  rolling.value = true;
  timers.push(
    setTimeout(() => {
      rolling.value = false;
      timers.push(
        setTimeout(
          () => {
            if (isLast.value) return emit('done');
            roundIndex.value += 1;
            playRound();
          },
          isLast.value ? FINAL_MS : SHOW_MS,
        ),
      );
    }, ROLL_MS),
  );
}

onMounted(playRound);
onBeforeUnmount(() => timers.forEach(clearTimeout));
</script>

<template>
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-night/80 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-label="Dice roll: who starts"
    data-testid="dice-roll"
    @click="emit('done')"
  >
    <div
      class="w-full max-w-sm animate-pop rounded-2xl border border-line bg-surface p-6 text-center"
    >
      <h2 class="text-lg font-bold">Who starts?</h2>
      <p class="mb-5 text-sm text-muted">Highest total plays first (red).</p>

      <div v-if="round" class="grid grid-cols-2 gap-4">
        <div v-for="(player, i) in players.slice(0, 2)" :key="player.id">
          <div class="mb-2 truncate text-sm font-semibold">{{ player.nickname }}</div>
          <div class="flex justify-center gap-2">
            <DieFace
              v-for="(value, d) in round.throws[i]"
              :key="`${roundIndex}-${d}`"
              :value="value"
              :rolling="rolling"
            />
          </div>
          <div class="mt-2 h-6 font-mono text-lg font-bold tabular-nums">
            <span v-if="!rolling">{{ round.totals[i] }}</span>
          </div>
        </div>
      </div>

      <p class="mt-4 h-6 font-semibold" aria-live="polite">
        <template v-if="!rolling && !isLast">Tie! Rolling again…</template>
        <template v-else-if="!rolling && isLast && winner">
          {{ winner.nickname }} starts!
        </template>
      </p>
      <p class="mt-2 text-xs text-muted">Tap to skip</p>
    </div>
  </div>
</template>
