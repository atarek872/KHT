<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'strong' | 'attention' }>(), { tone: 'neutral' })
</script>

<template>
  <span class="admin-badge" :class="`admin-badge--${tone}`"><slot /></span>
</template>