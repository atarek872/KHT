<script setup lang="ts">
defineProps<{
  name:
    | 'arrow'
    | 'search'
    | 'bag'
    | 'close'
    | 'menu'
    | 'plus'
    | 'minus'
    | 'check'
    | 'chevron'
    | 'user'
    | 'trash'
    | 'ruler'
    | 'whatsapp'
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
    <g v-else-if="name === 'user'">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </g>
    <path v-else-if="name === 'close'" d="m5 5 14 14M5 19 19 5" />
    <path v-else-if="name === 'menu'" d="M3 8h18M3 16h18" />
    <path v-else-if="name === 'plus'" d="M4 12h16M12 4v16" />
    <path v-else-if="name === 'minus'" d="M4 12h16" />
    <path v-else-if="name === 'check'" d="m4 12 5 5L20 6" />
    <g v-else-if="name === 'trash'">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      <path d="M10 11v6M14 11v6" />
    </g>
    <g v-else-if="name === 'ruler'">
      <path d="M3 16.5 16.5 3 21 7.5 7.5 21 3 16.5Z" />
      <path d="m13 6.5 2.5 2.5m-6 1 2.5 2.5m-6 1 2.5 2.5" />
    </g>
    <g v-else-if="name === 'whatsapp'" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.3-4.8a8.5 8.5 0 1 1 16.2-3.9Z" />
      <path
        d="M8.1 8.1c-.3.4-.7 1-.6 1.7.2 2.2 3 5.1 5.3 5.8.8.3 1.5.1 2-.3l.9-1.1-2.2-1.1-.9 1c-1.1-.4-2.4-1.7-3-2.8l.9-.8-1.2-2.3Z"
      />
    </g>
    <path v-else d="m9 5 7 7-7 7" />
  </svg>
</template>
