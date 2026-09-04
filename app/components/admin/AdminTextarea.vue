<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    id?: string
    label: string
    help?: string
    error?: string
    optional?: boolean
    rows?: number
  }>(),
  { id: undefined, help: undefined, error: undefined, optional: false, rows: 4 },
)
const model = defineModel<string | undefined>({ required: true })
const generatedId = useId()
const fieldId = computed(() => props.id || `admin-textarea-${generatedId}`)
const describedBy = computed(() =>
  [props.help && `${fieldId.value}-help`, props.error && `${fieldId.value}-error`]
    .filter(Boolean)
    .join(' ') || undefined,
)
</script>

<template>
  <div class="admin-field" :class="{ 'admin-field--invalid': error }">
    <label class="admin-field__label" :for="fieldId">
      {{ label }} <span v-if="optional" class="admin-field__optional">Optional</span>
    </label>
    <textarea
      :id="fieldId"
      v-model="model"
      v-bind="$attrs"
      class="admin-field__control admin-field__textarea"
      :rows="rows"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
    />
    <p v-if="help" :id="`${fieldId}-help`" class="admin-field__help">{{ help }}</p>
    <p v-if="error" :id="`${fieldId}-error`" class="admin-field__error" role="alert">
      {{ error }}
    </p>
  </div>
</template>