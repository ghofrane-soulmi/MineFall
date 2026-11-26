<script setup lang="ts">
/** Lobby: share the room (code, link, QR), see who is here, and get ready. */
import { computed, ref } from 'vue';
import { roomLink } from '../lib/format';
import { useGameStore } from '../stores/game';
import PlayerCard from './PlayerCard.vue';
import QrCode from './QrCode.vue';

const emit = defineEmits<{ leave: [] }>();
const store = useGameStore();

const code = computed(() => store.room?.code ?? '');
const link = computed(() => roomLink(code.value));
const copied = ref(false);
const waitingForOpponent = computed(() => store.players.length < 2);

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(link.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <div class="mx-auto grid w-full max-w-3xl gap-6 md:grid-cols-[1fr_auto]">
    <section class="space-y-5 rounded-2xl border border-line bg-surface p-6">
      <div>
        <p class="text-sm text-muted">Room code</p>
        <p class="font-mono text-4xl font-black tracking-[0.2em] text-mine" data-testid="room-code">
          {{ code }}
        </p>
      </div>
      <button
        type="button"
        class="w-full rounded-xl bg-surface-2 py-2.5 text-sm font-semibold transition hover:bg-line"
        @click="copyLink"
      >
        {{ copied ? 'Link copied ✓' : 'Copy invite link' }}
      </button>

      <div class="space-y-2">
        <PlayerCard
          v-for="player in store.players"
          :key="player.id"
          :player="player"
          :is-me="player.id === store.myId"
          :badge="player.ready ? 'Ready ✓' : 'Not ready'"
        />
        <div
          v-if="waitingForOpponent"
          class="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted"
        >
          Waiting for a second player… share the code or link.
        </div>
      </div>

      <p v-if="store.isSpectator" class="text-center text-sm text-muted">
        👁 You are watching. The game starts when both players are ready.
      </p>
      <div class="flex gap-2">
        <button
          v-if="!store.isSpectator"
          type="button"
          class="flex-1 rounded-xl py-3 font-bold transition disabled:opacity-40"
          :class="
            store.me?.ready
              ? 'bg-emerald-500 text-night'
              : 'bg-mine text-night hover:brightness-110'
          "
          :disabled="waitingForOpponent"
          :aria-pressed="store.me?.ready ?? false"
          data-testid="ready"
          @click="store.setReady(!store.me?.ready)"
        >
          {{ store.me?.ready ? 'Ready ✓ (click to cancel)' : "I'm ready" }}
        </button>
        <button
          type="button"
          class="rounded-xl bg-surface-2 px-4 text-sm font-semibold hover:bg-line"
          @click="emit('leave')"
        >
          {{ store.isSpectator ? 'Stop watching' : 'Leave' }}
        </button>
      </div>
    </section>

    <aside
      class="hidden flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-6 md:flex"
    >
      <QrCode :value="link" />
      <p class="text-xs text-muted">Scan to join</p>
    </aside>
  </div>
</template>
