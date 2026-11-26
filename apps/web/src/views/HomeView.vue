<script setup lang="ts">
/** Home: nickname, create a room, join with a code, resume a running game. */
import { normalizeRoomCode, ROOM_CODE_LENGTH } from '@minefall/shared';
import { computed, ref, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import HowToPlay from '../components/HowToPlay.vue';
import NicknameForm from '../components/NicknameForm.vue';
import { useGameStore } from '../stores/game';
import { useSessionStore } from '../stores/session';

const router = useRouter();
const session = useSessionStore();
const store = useGameStore();

const joinCode = ref('');
const creating = ref(false);
const validCode = computed(() => normalizeRoomCode(joinCode.value));

// With a session, connect right away: if we are still in a room, the server tells us.
watchEffect(() => {
  if (session.token) store.connect();
});

async function createRoom(): Promise<void> {
  creating.value = true;
  const code = await store.createRoom();
  creating.value = false;
  if (code) await router.push({ name: 'room', params: { code } });
}

async function joinRoom(): Promise<void> {
  if (validCode.value) await router.push({ name: 'room', params: { code: validCode.value } });
}

function changeNickname(): void {
  store.disconnect();
  session.logout();
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-md flex-col gap-6 py-6">
    <header class="text-center">
      <h1 class="text-5xl font-black tracking-tight">Mine<span class="text-mine">fall</span></h1>
      <p class="mt-2 text-muted">Line up four. Avoid the mines. Real-time, 2 players.</p>
    </header>

    <section class="space-y-4 rounded-2xl border border-line bg-surface p-6">
      <NicknameForm v-if="!session.player" />

      <template v-else>
        <div class="flex items-center justify-between">
          <p>
            Hi, <span class="font-bold" data-testid="greeting">{{ session.player.nickname }}</span>
          </p>
          <button
            type="button"
            class="text-sm text-muted underline-offset-4 hover:underline"
            @click="changeNickname"
          >
            Change nickname
          </button>
        </div>

        <RouterLink
          v-if="store.room"
          :to="{ name: 'room', params: { code: store.room.code } }"
          class="block rounded-xl bg-emerald-500 py-3 text-center font-bold text-night"
        >
          Back to your game ({{ store.room.code }})
        </RouterLink>

        <button
          v-else
          type="button"
          class="w-full rounded-xl bg-mine py-3 font-bold text-night transition hover:brightness-110 disabled:opacity-50"
          :disabled="creating || store.connection === 'offline'"
          data-testid="create-room"
          @click="createRoom"
        >
          {{ creating ? 'Creating…' : 'Create room' }}
        </button>

        <form v-if="!store.room" class="flex gap-2" @submit.prevent="joinRoom">
          <label for="join-code" class="sr-only">Room code</label>
          <input
            id="join-code"
            v-model="joinCode"
            :maxlength="ROOM_CODE_LENGTH"
            placeholder="Room code"
            autocomplete="off"
            class="min-w-0 flex-1 rounded-xl border border-line bg-night px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-mine"
            data-testid="join-code"
          />
          <button
            type="submit"
            class="rounded-xl bg-surface-2 px-5 font-semibold hover:bg-line disabled:opacity-40"
            :disabled="!validCode"
          >
            Join
          </button>
        </form>
      </template>
    </section>

    <HowToPlay />
  </div>
</template>
