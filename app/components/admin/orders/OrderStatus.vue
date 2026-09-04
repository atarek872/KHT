<script setup lang="ts">
const props = defineProps<{ value: string; label?: string }>()
const text = computed(() =>
  props.value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' '),
)
</script>

<template>
  <span class="admin-order-status">
    <span aria-hidden="true" />
    <span><span v-if="label" class="sr-only">{{ label }}: </span>{{ text }}</span>
  </span>
</template>