<script setup lang="ts">
/** Email + password form, used for both "Create account" and "Log in". */
import { PASSWORD_MIN_LENGTH, isValidPassword, normalizeEmail } from '@minefall/shared';
import { computed, ref } from 'vue';
import { ApiError } from '../services/api';

const props = defineProps<{
  submitLabel: string;
  /** Does the real work; throws ApiError with the server message on failure. */
  action: (email: string, password: string) => Promise<void>;
  newPassword?: boolean;
}>();
const emit = defineEmits<{ done: [] }>();

const email = ref('');
const password = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
const valid = computed(
  () => normalizeEmail(email.value) !== null && isValidPassword(password.value),
);

async function submit(): Promise<void> {
  if (!valid.value || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    await props.action(email.value, password.value);
    emit('done');
  } catch (e) {
    error.value = e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="submit">
    <div>
      <label for="account-email" class="mb-1 block text-sm font-semibold">Email</label>
      <input
        id="account-email"
        v-model="email"
        type="email"
        autocomplete="email"
        class="w-full rounded-xl border border-line bg-night px-4 py-2.5 outline-none focus:border-mine"
        data-testid="account-email"
      />
    </div>
    <div>
      <label for="account-password" class="mb-1 block text-sm font-semibold">Password</label>
      <input
        id="account-password"
        v-model="password"
        type="password"
        :autocomplete="newPassword ? 'new-password' : 'current-password'"
        class="w-full rounded-xl border border-line bg-night px-4 py-2.5 outline-none focus:border-mine"
        aria-describedby="account-hint"
        data-testid="account-password"
      />
      <p id="account-hint" class="mt-1 text-xs text-muted">
        At least {{ PASSWORD_MIN_LENGTH }} characters.
      </p>
    </div>
    <p v-if="error" class="text-sm text-red-token" role="alert" data-testid="account-error">
      {{ error }}
    </p>
    <button
      type="submit"
      class="w-full rounded-xl bg-mine py-2.5 font-bold text-night transition hover:brightness-110 disabled:opacity-40"
      :disabled="!valid || busy"
      data-testid="account-submit"
    >
      {{ busy ? 'Please wait…' : submitLabel }}
    </button>
  </form>
</template>
