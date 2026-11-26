<script setup lang="ts">
/** Nickname -> guest session. Validates with the same rule as the server (shared code). */
import { NICKNAME_MAX_LENGTH, normalizeNickname } from '@minefall/shared';
import { computed, ref } from 'vue';
import { ApiError } from '../services/api';
import { errorMessage } from '../lib/errors';
import { useSessionStore } from '../stores/session';

const emit = defineEmits<{ done: [] }>();
const session = useSessionStore();

const nickname = ref('');
const busy = ref(false);
const serverError = ref<string | null>(null);
const valid = computed(() => normalizeNickname(nickname.value) !== null);
const showHint = computed(() => nickname.value.length > 0 && !valid.value);

async function submit(): Promise<void> {
  if (!valid.value || busy.value) return;
  busy.value = true;
  serverError.value = null;
  try {
    await session.login(nickname.value);
    emit('done');
  } catch (error) {
    serverError.value =
      error instanceof ApiError && error.code === 'INVALID_NICKNAME'
        ? errorMessage('INVALID_NICKNAME')
        : error instanceof Error
          ? error.message
          : 'Something went wrong.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="space-y-2" @submit.prevent="submit">
    <label for="nickname" class="block text-sm font-semibold">Your nickname</label>
    <div class="flex gap-2">
      <input
        id="nickname"
        v-model="nickname"
        :maxlength="NICKNAME_MAX_LENGTH"
        autocomplete="nickname"
        placeholder="e.g. Ghof"
        class="min-w-0 flex-1 rounded-xl border border-line bg-night px-4 py-3 outline-none focus:border-mine"
        :aria-invalid="showHint"
        aria-describedby="nickname-hint"
        data-testid="nickname-input"
      />
      <button
        type="submit"
        class="rounded-xl bg-mine px-5 font-bold text-night transition hover:brightness-110 disabled:opacity-40"
        :disabled="!valid || busy"
        data-testid="nickname-submit"
      >
        Go
      </button>
    </div>
    <p
      id="nickname-hint"
      class="text-xs"
      :class="showHint || serverError ? 'text-red-token' : 'text-muted'"
    >
      {{ serverError ?? '3–16 characters: letters, digits, spaces, "_" or "-". No sign-up.' }}
    </p>
  </form>
</template>
