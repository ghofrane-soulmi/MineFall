import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useSessionStore } from '../stores/session';
import { ME } from '../test/fixtures';
import ProfileView from './ProfileView.vue';

const profile = {
  player: { ...ME, email: null },
  stats: {
    gamesPlayed: 4,
    wins: 2,
    losses: 1,
    draws: 1,
    winRate: 0.5,
    minesStepped: 3,
    trapsTriggered: 2,
  },
  recentGames: [
    {
      id: 'g1',
      endedAt: '2026-11-26T10:00:00.000Z',
      opponent: { nickname: 'Minebot', bot: true },
      result: 'win',
      reason: 'line',
      moveCount: 17,
    },
  ],
};

async function mountProfile() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/profile', component: ProfileView },
    ],
  });
  await router.push('/profile');
  const wrapper = mount(ProfileView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  useSessionStore().session = { token: 'guest-token', player: ME, email: null };
});
afterEach(() => vi.unstubAllGlobals());

describe('ProfileView', () => {
  it('shows totals and recent games, and offers a guest to create an account', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(profile))),
    );
    const wrapper = await mountProfile();

    expect(wrapper.get('[data-testid="stat-games"]').text()).toContain('4');
    expect(wrapper.get('[data-testid="stat-win-rate"]').text()).toContain('50%');
    expect(wrapper.get('[data-testid="stat-mines-stepped-on"]').text()).toContain('3');
    expect(wrapper.get('[data-testid="recent-games"]').text()).toContain('Minebot');
    expect(wrapper.text()).toContain('Keep your stats on any device');
    expect(wrapper.find('[data-testid="logout"]').exists()).toBe(false);
  });

  it('explains when the server has no database', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'ACCOUNTS_DISABLED', message: 'Accounts are not available.' }),
            { status: 503 },
          ),
      ),
    );
    const wrapper = await mountProfile();
    expect(wrapper.get('[role="alert"]').text()).toContain('Accounts are not available.');
  });
});
