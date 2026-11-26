<script setup lang="ts">
/** QR code of the room link, so a friend can join from their phone. */
import QRCode from 'qrcode';
import { ref, watchEffect } from 'vue';

const props = defineProps<{ value: string }>();
const src = ref<string | null>(null);

watchEffect(async () => {
  try {
    src.value = await QRCode.toDataURL(props.value, {
      margin: 1,
      width: 160,
      color: { dark: '#0b1020', light: '#f8fafc' },
    });
  } catch {
    src.value = null;
  }
});
</script>

<template>
  <img
    v-if="src"
    :src="src"
    alt="QR code with the room link"
    width="160"
    height="160"
    class="rounded-lg"
  />
</template>
