<script setup lang="ts">
/** Quick chat: 6 presets, emoji reactions, free text (≤ 120 chars). Text is rendered as text. */
import {
  CHAT_EMOJIS,
  CHAT_MAX_LENGTH,
  CHAT_PRESETS,
  type ChatMessagePayload,
  type ChatMessageType,
  type RoomPlayerInfo,
} from '@minefall/shared';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';

const props = defineProps<{
  messages: readonly ChatMessagePayload[];
  players: readonly RoomPlayerInfo[];
  myId: string | null;
}>();
const emit = defineEmits<{ send: [type: ChatMessageType, value: string] }>();

const draft = ref('');
const list = useTemplateRef<HTMLElement>('list');
const presetText = (id: string): string => CHAT_PRESETS.find((p) => p.id === id)?.text ?? id;
const remaining = computed(() => CHAT_MAX_LENGTH - draft.value.length);

function author(message: ChatMessagePayload): RoomPlayerInfo | undefined {
  return props.players.find((p) => p.id === message.playerId);
}

function sendText(): void {
  const text = draft.value.trim();
  if (!text) return;
  emit('send', 'text', text);
  draft.value = '';
}

watch(
  () => props.messages.length,
  () => nextTick(() => list.value?.scrollTo({ top: list.value.scrollHeight })),
);
</script>

<template>
  <section
    class="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-surface"
    aria-label="Chat"
  >
    <ol
      ref="list"
      class="min-h-24 flex-1 space-y-1.5 overflow-y-auto p-3 text-sm"
      aria-live="polite"
      data-testid="chat-messages"
    >
      <li v-if="messages.length === 0" class="text-muted">Say hi 👋</li>
      <li v-for="m in messages" :key="m.id" class="break-words">
        <span
          class="font-semibold"
          :class="
            author(m)?.color === 'red'
              ? 'text-red-token'
              : author(m)?.color === 'yellow'
                ? 'text-yellow-token'
                : 'text-slate-300'
          "
        >
          {{ m.playerId === myId ? 'You' : (author(m)?.nickname ?? '?') }}:
        </span>
        <span :class="m.type === 'emoji' && 'text-lg'">
          {{ m.type === 'preset' ? presetText(m.value) : m.value }}
        </span>
      </li>
    </ol>

    <div class="space-y-2 border-t border-line p-3">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="preset in CHAT_PRESETS"
          :key="preset.id"
          type="button"
          class="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium transition hover:bg-line"
          @click="emit('send', 'preset', preset.id)"
        >
          {{ preset.text }}
        </button>
      </div>
      <div class="flex gap-1" role="group" aria-label="Emoji reactions">
        <button
          v-for="emoji in CHAT_EMOJIS"
          :key="emoji"
          type="button"
          class="grid size-9 place-items-center rounded-lg text-lg transition hover:bg-surface-2"
          :aria-label="`React ${emoji}`"
          @click="emit('send', 'emoji', emoji)"
        >
          {{ emoji }}
        </button>
      </div>
      <form class="flex gap-2" @submit.prevent="sendText">
        <label class="sr-only" for="chat-input">Message</label>
        <input
          id="chat-input"
          v-model="draft"
          :maxlength="CHAT_MAX_LENGTH"
          autocomplete="off"
          placeholder="Type a message…"
          class="min-w-0 flex-1 rounded-lg border border-line bg-night px-3 py-2 text-sm outline-none focus:border-mine"
        />
        <button
          type="submit"
          class="rounded-lg bg-mine px-3 py-2 text-sm font-bold text-night disabled:opacity-40"
          :disabled="!draft.trim()"
        >
          Send
        </button>
      </form>
      <p v-if="remaining < 20" class="text-right text-xs text-muted">{{ remaining }} left</p>
    </div>
  </section>
</template>
