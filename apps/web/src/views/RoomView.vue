<script setup lang="ts">
/**
 * /room/:code - asks for a nickname if needed, connects, joins the room, then shows the
 * lobby or the game. Joining a room you are already in just resyncs (page refresh).
 */
import type { AckErrorCode } from '@minefall/shared';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import GameScreen from '../components/GameScreen.vue';
import LobbyPanel from '../components/LobbyPanel.vue';
import NicknameForm from '../components/NicknameForm.vue';
import { errorMessage } from '../lib/errors';
import { useGameStore } from '../stores/game';
import { useSessionStore } from '../stores/session';

const props = defineProps<{ code: string }>();
const router = useRouter();
const session = useSessionStore();
const store = useGameStore();

const joinError = ref<AckErrorCode | null>(null);
const inThisRoom = computed(() => store.room?.code === props.code);

async function join(): Promise<void> {
  joinError.value = null;
  store.connect();
  const ack = await store.joinRoom(props.code);
  if (!ack.ok) joinError.value = ack.error;
}

watch(
  () => [session.token, props.code] as const,
  ([token]) => {
    if (token) void join();
  },
  { immediate: true },
);

async function leaveOtherRoomAndJoin(): Promise<void> {
  await store.leaveRoom();
  await join();
}

async function leave(): Promise<void> {
  await store.leaveRoom();
  await router.push({ name: 'home' });
}
</script>

<template>
  <div class="py-4">
    <div
      v-if="!session.player"
      class="mx-auto max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6"
    >
      <h1 class="text-xl font-bold">
        Join room <span class="font-mono text-mine">{{ code }}</span>
      </h1>
      <NicknameForm />
    </div>

    <div
      v-else-if="joinError && !inThisRoom"
      class="mx-auto max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6 text-center"
      role="alert"
    >
      <p class="font-semibold" data-testid="join-error">{{ errorMessage(joinError) }}</p>
      <div class="flex justify-center gap-2">
        <button
          v-if="joinError === 'ALREADY_IN_ROOM'"
          type="button"
          class="rounded-xl bg-mine px-4 py-2 font-bold text-night"
          @click="leaveOtherRoomAndJoin"
        >
          Leave my other room and join
        </button>
        <RouterLink to="/" class="rounded-xl bg-surface-2 px-4 py-2 font-semibold hover:bg-line">
          Back home
        </RouterLink>
      </div>
    </div>

    <p v-else-if="!inThisRoom" class="py-20 text-center text-muted">Joining room {{ code }}…</p>

    <LobbyPanel v-else-if="store.phase === 'lobby'" @leave="leave" />
    <GameScreen v-else @leave="leave" />
  </div>
</template>
