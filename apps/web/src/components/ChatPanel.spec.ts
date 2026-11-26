import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ME, OPP } from '../test/fixtures';
import ChatPanel from './ChatPanel.vue';

const players = [
  { ...ME, color: 'red' as const, online: true, ready: true, wantsRematch: false, bot: null },
  { ...OPP, color: 'yellow' as const, online: true, ready: true, wantsRematch: false, bot: null },
];

describe('ChatPanel', () => {
  it('sends presets by id and emojis by value', async () => {
    const wrapper = mount(ChatPanel, { props: { messages: [], players, myId: ME.id } });
    await wrapper.get('button:first-of-type').trigger('click');
    await wrapper.get('[aria-label="React 💣"]').trigger('click');
    expect(wrapper.emitted('send')).toEqual([
      ['preset', 'gg'],
      ['emoji', '💣'],
    ]);
  });

  it('sends trimmed text and clears the input', async () => {
    const wrapper = mount(ChatPanel, { props: { messages: [], players, myId: ME.id } });
    await wrapper.get('input').setValue('  well played  ');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('send')).toEqual([['text', 'well played']]);
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
  });

  it('renders messages as text (no HTML) with preset text resolved', () => {
    const wrapper = mount(ChatPanel, {
      props: {
        players,
        myId: ME.id,
        messages: [
          { id: '1', playerId: OPP.id, type: 'text', value: '<b>bold</b>', sentAt: 0 },
          { id: '2', playerId: ME.id, type: 'preset', value: 'nice', sentAt: 0 },
        ],
      },
    });
    const list = wrapper.get('[data-testid="chat-messages"]');
    expect(list.find('b').exists()).toBe(false);
    expect(list.text()).toContain('<b>bold</b>');
    expect(list.text()).toContain('You: Nice move!');
  });

  it('read-only mode (spectators) hides every way to send', () => {
    const wrapper = mount(ChatPanel, {
      props: { messages: [], players, myId: 'spectator', readOnly: true },
    });
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.text()).toContain('Spectators can read the chat but not write.');
  });
});
