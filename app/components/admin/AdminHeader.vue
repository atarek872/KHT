<script setup lang="ts">
defineProps<{ title: string; navigationOpen: boolean }>()
defineEmits<{ toggleNavigation: [] }>()
const loggingOut = ref(false)

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await $fetch('/api/admin/logout', { method: 'POST' })
    await navigateTo('/admin/login')
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <header class="admin-shell-header">
    <button
      type="button"
      class="admin-shell-header__menu"
      aria-label="Toggle admin navigation"
      aria-controls="admin-mobile-navigation"
      :aria-expanded="navigationOpen"
      @click="$emit('toggleNavigation')"
    >
      <KhtIcon name="menu" />
    </button>
    <div class="admin-shell-header__title">
      <span aria-hidden="true" />
      <p>{{ title }}</p>
    </div>
    <div class="admin-shell-header__account">
      <p class="admin-shell-header__mode">KHT / Admin</p>
      <button type="button" :disabled="loggingOut" @click="logout">
        {{ loggingOut ? 'Signing out' : 'Sign out' }}
      </button>
    </div>
  </header>
</template>