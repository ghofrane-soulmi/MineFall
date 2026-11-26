<script setup lang="ts">
/**
 * /profile - "My stats": totals and recent games for the current player (guest or account),
 * plus "Create an account" for guests or "Log out" for accounts.
 */
import type { ProfileResponse } from '@minefall/shared';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AccountForm from '../components/AccountForm.vue';
import { ApiError, fetchProfile } from '../services/api';
import { useGameStore } from '../stores/game';
import { useSessionStore } from '../stores/session';

const router = useRouter();
const session = useSessionStore();
const game = useGameStore();

const profile = ref<ProfileResponse | null>(null);
const loadError = ref<string | null>(null);
const loading = ref(false);

async function load(): Promise<void> {
  if (!session.token) return;
  loading.value = true;
  loadError.value = null;
  try {
    profile.value = await fetchProfile(session.token);
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Could not load your stats.';
  } finally {
    loading.value = false;
  }
}

watch(
  () => session.token,
  (token) => {
    if (token) void load();
    else void router.replace({ name: 'home' });
  },
  { immediate: true },
);

const cards = computed(() => {
  const s = profile.value?.stats;
  if (!s) return [];
  return [
    { label: 'Games', value: String(s.gamesPlayed) },
    { label: 'Wins', value: String(s.wins) },
    { label: 'Losses', value: String(s.losses) },
    { label: 'Draws', value: String(s.draws) },
    { label: 'Win rate', value: `${Math.round(s.winRate * 100)}%` },
    { label: 'Mines stepped on', value: String(s.minesStepped) },
    { label: 'Traps that worked', value: String(s.trapsTriggered) },
  ];
});

const RESULT_LABEL = { win: 'Win', loss: 'Loss', draw: 'Draw' } as const;
const REASON_LABEL = { line: 'four in a row', forfeit: 'forfeit', draw: 'no moves left' } as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

async function register(email: string, password: string): Promise<void> {
  await session.register(email, password);
}

function logout(): void {
  game.disconnect();
  session.logout();
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6 py-4">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-black">My stats</h1>
        <p class="text-muted">
          {{ session.player?.nickname }}
          <span v-if="session.email"> · {{ session.email }}</span>
          <span v-else> · guest</span>
        </p>
      </div>
      <button
        v-if="session.email"
        type="button"
        class="rounded-xl bg-surface-2 px-4 py-2 text-sm font-semibold hover:bg-line"
        data-testid="logout"
        @click="logout"
      >
        Log out
      </button>
    </header>

    <p v-if="loading && !profile" class="text-muted">Loading…</p>
    <p v-if="loadError" class="rounded-xl border border-line bg-surface p-4" role="alert">
      {{ loadError }}
    </p>

    <template v-if="profile">
      <section aria-label="Totals" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          v-for="card in cards"
          :key="card.label"
          class="rounded-2xl border border-line bg-surface p-4"
          :data-testid="`stat-${card.label.toLowerCase().replaceAll(' ', '-')}`"
        >
          <p class="text-xs text-muted">{{ card.label }}</p>
          <p class="font-mono text-2xl font-black">{{ card.value }}</p>
        </div>
      </section>

      <section class="rounded-2xl border border-line bg-surface p-5">
        <h2 class="mb-3 font-bold">Recent games</h2>
        <p v-if="profile.recentGames.length === 0" class="text-sm text-muted">
          No finished games yet. Go play one!
        </p>
        <ul v-else class="divide-y divide-line" data-testid="recent-games">
          <li
            v-for="g in profile.recentGames"
            :key="g.id"
            class="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
          >
            <span>
              <span
                class="mr-2 inline-block w-12 rounded-full px-2 text-center text-xs font-bold"
                :class="{
                  'bg-emerald-500 text-night': g.result === 'win',
                  'bg-red-token/80 text-white': g.result === 'loss',
                  'bg-surface-2': g.result === 'draw',
                }"
              >
                {{ RESULT_LABEL[g.result] }}
              </span>
              vs <span class="font-semibold">{{ g.opponent.nickname }}</span>
              <span v-if="g.opponent.bot"> 🤖</span>
              <span class="text-muted">
                · {{ REASON_LABEL[g.reason] }} · {{ g.moveCount }} moves</span
              >
            </span>
            <span class="text-xs text-muted">{{ formatDate(g.endedAt) }}</span>
          </li>
        </ul>
      </section>
    </template>

    <section
      v-if="!session.email && !loadError"
      class="space-y-3 rounded-2xl border border-mine/40 bg-surface p-5"
    >
      <h2 class="font-bold">Keep your stats on any device</h2>
      <p class="text-sm text-muted">
        Create an account: you keep this nickname and every game you already played.
      </p>
      <AccountForm submit-label="Create my account" new-password :action="register" @done="load" />
    </section>
  </div>
</template>
