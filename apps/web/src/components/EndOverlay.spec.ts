import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ME, OPP } from '../test/fixtures';
import EndOverlay from './EndOverlay.vue';

const players = [
  { ...ME, color: 'red' as const, online: true, ready: false, wantsRematch: false, bot: null },
  { ...OPP, color: 'yellow' as const, online: true, ready: false, wantsRematch: false, bot: null },
];
const summary = {
  result: { type: 'win' as const, winnerId: OPP.id, winningLine: [] },
  allMines: [],
  explodedMines: [],
  moveCount: 9,
  durationMs: 61_000,
};

describe('EndOverlay', () => {
  it('a player sees their own result and can ask for a rematch', () => {
    const wrapper = mount(EndOverlay, { props: { summary, players, myId: ME.id } });
    expect(wrapper.get('[data-testid="end-title"]').text()).toBe('You lose');
    expect(wrapper.find('[data-testid="rematch"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('1:01');
  });

  it('a spectator sees who won, and has no rematch button', () => {
    const wrapper = mount(EndOverlay, {
      props: { summary, players, myId: 'viewer', spectator: true },
    });
    expect(wrapper.get('[data-testid="end-title"]').text()).toBe(`${OPP.nickname} wins!`);
    expect(wrapper.find('[data-testid="rematch"]').exists()).toBe(false);
  });
});
