<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    busy?: boolean
    danger?: boolean
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    busy: false,
    danger: false,
  },
)
defineEmits<{ confirm: []; close: [] }>()
</script>

<template>
  <AdminModal :open="open" :title="title" @close="$emit('close')">
    <p class="admin-modal__description">{{ description }}</p>
    <template #actions>
      <AdminButton variant="quiet" :disabled="busy" autofocus @click="$emit('close')">
        {{ cancelLabel }}
      </AdminButton>
      <AdminButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="busy"
        :loading-label="confirmLabel"
        @click="$emit('confirm')"
      >
        {{ confirmLabel }}
      </AdminButton>
    </template>
  </AdminModal>
</template>