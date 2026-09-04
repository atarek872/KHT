<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
let restoreFocus: HTMLElement | null = null
let desktopQuery: MediaQueryList | null = null

function showNavigation() {
  if (!dialog.value || dialog.value.open) return
  restoreFocus = document.activeElement as HTMLElement | null
  dialog.value.showModal()
  document.body.style.overflow = 'hidden'
}

function hideNavigation() {
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
    if (open) showNavigation()
    else hideNavigation()
  },
)

onMounted(() => {
  desktopQuery = window.matchMedia('(min-width: 1024px)')
  desktopQuery.addEventListener('change', handleViewportChange)
  if (props.open) showNavigation()
})

onBeforeUnmount(() => {
  desktopQuery?.removeEventListener('change', handleViewportChange)
  document.body.style.overflow = ''
})

function handleViewportChange(event: MediaQueryListEvent) {
  if (event.matches && props.open) emit('close')
}
</script>

<template>
  <dialog
    id="admin-mobile-navigation"
    ref="dialog"
    class="admin-mobile-navigation"
    aria-label="Admin navigation"
    @cancel.prevent="emit('close')"
    @click="($event) => $event.target === $event.currentTarget && emit('close')"
  >
    <button
      type="button"
      class="admin-mobile-navigation__close"
      aria-label="Close admin navigation"
      @click="emit('close')"
    >
      <KhtIcon name="close" />
    </button>
    <AdminSidebar @navigate="emit('close')" />
  </dialog>
</template>