<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string; closeLabel?: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const titleId = `admin-modal-title-${useId()}`
let restoreFocus: HTMLElement | null = null

function openDialog() {
  if (!dialog.value || dialog.value.open) return
  restoreFocus = document.activeElement as HTMLElement | null
  dialog.value.showModal()
  document.body.style.overflow = 'hidden'
}

function closeDialog() {
  if (!dialog.value?.open) return
  dialog.value.close()
  document.body.style.overflow = ''
  restoreFocus?.focus()
  restoreFocus = null
}

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    if (open) openDialog()
    else closeDialog()
  },
)

onMounted(() => {
  if (props.open) openDialog()
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <dialog
    ref="dialog"
    class="admin-modal"
    :aria-labelledby="titleId"
    @cancel.prevent="emit('close')"
    @click="($event) => $event.target === $event.currentTarget && emit('close')"
  >
    <header class="admin-modal__header">
      <h2 :id="titleId">{{ title }}</h2>
      <button
        type="button"
        class="admin-modal__close"
        :aria-label="closeLabel || 'Close dialog'"
        @click="emit('close')"
      >
        <KhtIcon name="close" />
      </button>
    </header>
    <div class="admin-modal__body"><slot /></div>
    <footer v-if="$slots.actions" class="admin-modal__actions"><slot name="actions" /></footer>
  </dialog>
</template>