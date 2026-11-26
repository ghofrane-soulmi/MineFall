<script setup lang="ts">
/** A small mine glyph. `variant` changes its look: own (discreet), pending, exploded, revealed. */
defineProps<{ variant: 'own' | 'pending' | 'exploded' | 'revealed-red' | 'revealed-yellow' }>();
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    class="pointer-events-none"
    :class="{
      'size-2/5 opacity-70': variant === 'own',
      'size-3/5 animate-pop': variant === 'pending',
      'size-1/2 opacity-50': variant === 'exploded',
      'size-1/2': variant === 'revealed-red' || variant === 'revealed-yellow',
    }"
    aria-hidden="true"
  >
    <template v-if="variant === 'exploded'">
      <path
        d="M12 2l2 6 6-3-3 6 6 2-6 2 3 6-6-3-2 6-2-6-6 3 3-6-6-2 6-2-3-6 6 3z"
        fill="var(--color-mine)"
      />
    </template>
    <template v-else>
      <path
        d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8L7 17M17 7l2.8-2.8"
        stroke="var(--color-mine)"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="6.5"
        fill="var(--color-mine)"
        :stroke="
          variant === 'revealed-red'
            ? 'var(--color-red-token)'
            : variant === 'revealed-yellow'
              ? 'var(--color-yellow-token)'
              : 'none'
        "
        stroke-width="2.5"
      />
      <circle cx="10" cy="10" r="1.8" fill="#fff7" />
    </template>
  </svg>
</template>
