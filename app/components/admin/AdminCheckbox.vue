<script setup lang="ts">
const props = withDefaults(
  defineProps<{ id?: string; label: string; help?: string; error?: string; disabled?: boolean }>(),
  { id: undefined, help: undefined, error: undefined, disabled: false },
)
const model = defineModel<boolean>({ required: true })
const generatedId = useId()
const fieldId = computed(() => props.id || `admin-checkbox-${generatedId}`)
const describedBy = computed(() =>
  [props.help && `${fieldId.value}-help`, props.error && `${fieldId.value}-error`]
    .filter(Boolean)
    .join(' ') || undefined,
)
</script>

<template>
  <div class="admin-checkbox" :class="{ 'admin-checkbox--invalid': error }">
    <label :for="fieldId" class="admin-checkbox__label">
      <input
        :id="fieldId"
        v-model="model"
        type="checkbox"
        class="admin-checkbox__control"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
      />
      <span>{{ label }}</span>
    </label>
    <p v-if="help" :id="`${fieldId}-help`" class="admin-field__help">{{ help }}</p>
    <p v-if="error" :id="`${fieldId}-error`" class="admin-field__error" role="alert">
      {{ error }}
    </p>
  </div>
</template>