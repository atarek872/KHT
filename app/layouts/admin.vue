<script setup lang="ts">
const route = useRoute()
const navigationOpen = ref(false)
const pageTitle = computed(() => (route.path === '/admin' ? 'Dashboard' : 'Admin'))

watch(
  () => route.fullPath,
  () => {
    navigationOpen.value = false
  },
)

useHead({
  htmlAttrs: { lang: 'en', dir: 'ltr' },
  bodyAttrs: { class: 'kht-admin-body' },
})
</script>

<template>
  <div class="kht-admin admin-shell">
    <a class="admin-skip-link" href="#admin-main">Skip to content</a>
    <aside class="admin-shell__desktop-sidebar"><AdminSidebar /></aside>
    <div class="admin-shell__workspace">
      <AdminHeader
        :title="pageTitle"
        :navigation-open="navigationOpen"
        @toggle-navigation="navigationOpen = !navigationOpen"
      />
      <main id="admin-main" class="admin-shell__main" tabindex="-1"><slot /></main>
    </div>
    <AdminMobileNavigation :open="navigationOpen" @close="navigationOpen = false" />
  </div>
</template>