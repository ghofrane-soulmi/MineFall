/**
 * The player session (token + identity, plus email for accounts), kept in localStorage so a
 * refresh or a shared link reopened later still knows who you are.
 */
import type { GuestSession } from '@minefall/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { loginAsGuest, loginWithPassword, registerAccount } from '../services/api';

const STORAGE_KEY = 'minefall.session';

function readStored(): GuestSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as GuestSession;
    return { ...stored, email: stored.email ?? null }; // sessions saved before accounts existed
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
  /** Set once the player has an account (email + password). */
  const email = computed(() => session.value?.email ?? null);

  function save(next: GuestSession): void {
    session.value = next;
    writeStored(next);
  }

  /** Starts as a guest: nickname only. */
  async function login(nickname: string): Promise<void> {
    save(await loginAsGuest(nickname));
  }

  /** Adds an email + password to the current guest (same player, same games). */
  async function register(newEmail: string, password: string): Promise<void> {
    if (!session.value) throw new Error('register: no guest session');
    save(await registerAccount(session.value.token, newEmail, password));
  }

  /** Logs in to an existing account (e.g. on another device). */
  async function loginAccount(accountEmail: string, password: string): Promise<void> {
    save(await loginWithPassword(accountEmail, password));
  }

  function logout(): void {
    session.value = null;
    writeStored(null);
  }

  return { session, player, token, email, login, register, loginAccount, logout };
});
