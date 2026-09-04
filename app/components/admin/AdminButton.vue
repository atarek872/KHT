<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
    loading?: boolean
    loadingLabel?: string
    disabled?: boolean
    block?: boolean
  }>(),
  {
    type: 'button',
    variant: 'primary',
    loading: false,
    loadingLabel: 'Working',
    disabled: false,
    block: false,
  },
)
</script>

<template>
  <button
    :type="type"
    class="admin-button"
    :class="[`admin-button--${variant}`, { 'admin-button--block': block }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="admin-button__loader" aria-hidden="true" />
    <span>{{ loading ? loadingLabel : undefined }}<slot v-if="!loading" /></span>
  </button>
</template>