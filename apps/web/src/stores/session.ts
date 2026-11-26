/**
 * The guest session (token + identity), kept in localStorage so a refresh or a shared link
 * reopened later still knows who you are.
 */
import type { GuestSession } from '@minefall/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { loginAsGuest } from '../services/api';

const STORAGE_KEY = 'minefall.session';

function readStored(): GuestSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

function writeStored(session: GuestSession | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode / storage disabled: the session simply lasts for this tab.
  }
}

export const useSessionStore = defineStore('session', () => {
  const session = ref<GuestSession | null>(readStored());

  const player = computed(() => session.value?.player ?? null);
  const token = computed(() => session.value?.token ?? null);

  async function login(nickname: string): Promise<void> {
    session.value = await loginAsGuest(nickname);
    writeStored(session.value);
  }

  function logout(): void {
    session.value = null;
    writeStored(null);
  }

  return { session, player, token, login, logout };
});
