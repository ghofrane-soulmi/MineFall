import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { emptyBoard } from '../../test/fixtures';
import GameBoard from './GameBoard.vue';

function mountBoard(props: Partial<InstanceType<typeof GameBoard>['$props']> = {}) {
  return mount(GameBoard, {
    props: {
      board: emptyBoard(),
      mode: 'play',
      myColor: 'red',
      ownMines: [],
      pendingMines: [],
      explodedMines: [],
      revealedMines: null,
      blockedColumns: {},
      winningLine: null,
      lastMove: null,
      colorOf: () => 'red',
      ...props,
    },
  });
}

describe('GameBoard', () => {
  it('emits drop with the clicked column in play mode', async () => {
    const wrapper = mountBoard();
    await wrapper.get('[data-testid="column-4"]').trigger('click');
    expect(wrapper.emitted('drop')).toEqual([[4]]);
  });

  it('disables blocked and full columns', async () => {
    const board = emptyBoard();
    for (const row of board) row[0] = 'yellow';
    const wrapper = mountBoard({ board, blockedColumns: { 3: 1 } });
    expect(wrapper.get('[data-testid="column-0"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="column-3"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="column-3"]').attributes('aria-label')).toMatch(/blocked/);
    expect(wrapper.text()).toContain('Blocked');
  });

  it('arrow keys move between columns (one tab stop)', async () => {
    const wrapper = mountBoard();
    const tabStops = () =>
      wrapper.findAll('[tabindex="0"]').map((b) => b.attributes('data-testid'));
    expect(tabStops()).toEqual(['column-3']);
    await wrapper.get('[data-testid="column-3"]').trigger('keydown', { key: 'ArrowRight' });
    expect(tabStops()).toEqual(['column-4']);
  });

  it('has no column buttons when it is not my turn', () => {
    expect(mountBoard({ mode: 'view' }).find('[data-testid="column-0"]').exists()).toBe(false);
  });

  it('placement mode: cells toggle mines, but never on the top row', async () => {
    const wrapper = mountBoard({ mode: 'placement' });
    await wrapper.get('[data-testid="cell-2-3"]').trigger('click');
    expect(wrapper.emitted('toggleCell')).toEqual([[{ col: 2, row: 3 }]]);
    expect(wrapper.get('[data-testid="cell-2-0"]').attributes('disabled')).toBeDefined();
  });
});
