<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
    busy?: boolean
    danger?: boolean
    requiredConfirmation?: string
    confirmationPrompt?: string
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    busy: false,
    danger: false,
    requiredConfirmation: '',
    confirmationPrompt: 'Type the confirmation value to continue.',
  },
)
const emit = defineEmits<{ confirm: []; close: [] }>()
const typedConfirmation = ref('')
const confirmationMatches = computed(
  () => !props.requiredConfirmation || typedConfirmation.value === props.requiredConfirmation,
)

watch(
  () => props.open,
  (open) => {
    if (open) typedConfirmation.value = ''
  },
)

function confirm() {
  if (confirmationMatches.value && !props.busy) emit('confirm')
}
</script>

<template>
  <AdminModal :open="open" :title="title" @close="$emit('close')">
    <p class="admin-modal__description">{{ description }}</p>
    <label v-if="requiredConfirmation" class="admin-confirm-dialog__field">
      <span>{{ confirmationPrompt }}</span>
      <input
        v-model="typedConfirmation"
        class="admin-confirm-dialog__input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="typedConfirmation && !confirmationMatches ? 'true' : undefined"
        @keydown.enter.prevent="confirm"
      />
    </label>
    <template #actions>
      <AdminButton variant="quiet" :disabled="busy" autofocus @click="$emit('close')">
        {{ cancelLabel }}
      </AdminButton>
      <AdminButton
        :variant="danger ? 'danger' : 'primary'"
        :loading="busy"
        :disabled="busy || !confirmationMatches"
        :loading-label="confirmLabel"
        @click="confirm"
      >
        {{ confirmLabel }}
      </AdminButton>
    </template>
  </AdminModal>
</template>
