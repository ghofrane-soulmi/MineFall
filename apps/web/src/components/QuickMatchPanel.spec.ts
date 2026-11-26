import { QUICK_MATCH_BOT_OFFER_MS } from '@minefall/shared';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QuickMatchPanel from './QuickMatchPanel.vue';

describe('QuickMatchPanel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the waiting time and lets the player cancel', async () => {
    const wrapper = mount(QuickMatchPanel);
    vi.advanceTimersByTime(12_000);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('0:12');
    await wrapper.get('[data-testid="quick-match-cancel"]').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('offers Minebot only after 30 seconds without an opponent', async () => {
    const wrapper = mount(QuickMatchPanel);
    vi.advanceTimersByTime(QUICK_MATCH_BOT_OFFER_MS - 1_000);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="quick-match-bot"]').exists()).toBe(false);

    vi.advanceTimersByTime(1_000);
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="quick-match-bot"]').trigger('click');
    expect(wrapper.emitted('playBot')).toHaveLength(1);
  });
});
