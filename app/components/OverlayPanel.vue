<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title: string
  side?: 'start' | 'end'
  wide?: boolean
}>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const { t } = useLanguage()
let restore: HTMLElement | null = null
watch(
  () => props.open,
  async (value) => {
    await nextTick()
    if (value) {
      restore = document.activeElement as HTMLElement
      dialog.value?.showModal()
      document.body.style.overflow = 'hidden'
    } else {
      dialog.value?.close()
      document.body.style.overflow = ''
      restore?.focus()
    }
  },
)
onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>
<template>
  <dialog
    ref="dialog"
    class="overlay-panel"
    :class="{ 'panel-start': side === 'start', 'panel-wide': wide }"
    :aria-label="title"
    @cancel.prevent="emit('close')"
    @click="
      (e) => {
        if (e.target === dialog) emit('close')
      }
    "
  >
    <div class="panel-content">
      <div class="panel-heading">
        <h2>{{ title }}</h2>
        <button class="icon-button" :aria-label="t('Close', 'إغلاق')" @click="emit('close')">
          <KhtIcon name="close" />
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>
