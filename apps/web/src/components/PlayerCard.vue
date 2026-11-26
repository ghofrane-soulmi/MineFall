<script setup lang="ts">
/** A player's nickname, colour, online status and contextual badge (ready / turn / waiting). */
import type { RoomPlayerInfo } from '@minefall/shared';
import { useCountdown } from '../composables/useCountdown';
import TokenPiece from './board/TokenPiece.vue';

const props = defineProps<{
  player: RoomPlayerInfo;
  isMe: boolean;
  isTurn?: boolean;
  badge?: string | null;
  graceEndsAt?: number | null;
  clockOffset?: number;
}>();

const { seconds: graceSeconds } = useCountdown(
  () => props.graceEndsAt ?? null,
  () => props.clockOffset ?? 0,
);
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-3 rounded-xl border bg-surface px-3 py-2 transition"
    :class="isTurn ? 'border-mine shadow-[0_0_0_3px_rgb(245_158_11/0.25)]' : 'border-line'"
    :data-testid="isMe ? 'player-me' : 'player-opponent'"
  >
    <div class="size-8 shrink-0">
      <TokenPiece v-if="player.color" :color="player.color" />
      <div
        v-else
        class="grid size-full place-items-center rounded-full bg-surface-2 text-sm text-muted"
      >
        ?
      </div>
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1.5">
        <span
          class="size-2 shrink-0 rounded-full"
          :class="player.online ? 'bg-emerald-400' : 'bg-slate-500'"
          :aria-label="player.online ? 'online' : 'offline'"
        />
        <span class="truncate font-semibold">{{ player.nickname }}</span>
        <span v-if="isMe" class="text-xs text-muted">(you)</span>
      </div>
      <div class="truncate text-xs text-muted">
        <template v-if="!player.online && graceSeconds !== null">
          Disconnected · forfeits in {{ graceSeconds }}s
        </template>
        <template v-else-if="!player.online">Disconnected</template>
        <template v-else-if="badge">{{ badge }}</template>
      </div>
    </div>
  </div>
</template>
