<script setup lang="ts">
defineProps<{
  name: 'arrow' | 'search' | 'bag' | 'close' | 'menu' | 'plus' | 'minus' | 'check' | 'chevron'
}>()
</script>
<template>
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="square"
    aria-hidden="true"
    :class="{ 'directional-icon': name === 'arrow' || name === 'chevron' }"
  >
    <path v-if="name === 'arrow'" d="M3 12h17m-6-6 6 6-6 6" />
    <g v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </g>
    <g v-else-if="name === 'bag'">
      <path d="M5 7h14l1 14H4L5 7Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </g>
    <path v-else-if="name === 'close'" d="m5 5 14 14M5 19 19 5" />
    <path v-else-if="name === 'menu'" d="M3 8h18M3 16h18" />
    <path v-else-if="name === 'plus'" d="M4 12h16M12 4v16" />
    <path v-else-if="name === 'minus'" d="M4 12h16" />
    <path v-else-if="name === 'check'" d="m4 12 5 5L20 6" />
    <path v-else d="m9 5 7 7-7 7" />
  </svg>
</template>
