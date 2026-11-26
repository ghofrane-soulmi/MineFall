<script setup lang="ts">
/** /login - log in to an existing account (e.g. on a new device). */
import { useRouter } from 'vue-router';
import AccountForm from '../components/AccountForm.vue';
import { useGameStore } from '../stores/game';
import { useSessionStore } from '../stores/session';

const router = useRouter();
const session = useSessionStore();
const game = useGameStore();

async function login(email: string, password: string): Promise<void> {
  await session.loginAccount(email, password);
}

async function done(): Promise<void> {
  game.disconnect(); // reconnect with the account's token
  game.connect();
  await router.push({ name: 'home' });
}
</script>

<template>
  <div class="mx-auto max-w-md space-y-4 py-6">
    <section class="space-y-4 rounded-2xl border border-line bg-surface p-6">
      <h1 class="text-2xl font-black">Log in</h1>
      <p class="text-sm text-muted">Get your nickname and stats back on this device.</p>
      <AccountForm submit-label="Log in" :action="login" @done="done" />
    </section>
    <p class="text-center text-sm text-muted">
      No account? Just pick a nickname on the
      <RouterLink to="/" class="font-semibold text-mine hover:underline">home page</RouterLink>,
      play, then create one from "My stats".
    </p>
  </div>
</template>
