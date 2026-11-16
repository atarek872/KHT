export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin') || to.path === '/admin/login') return
  try {
    if (import.meta.server) await useRequestFetch()('/api/admin/session')
    else await $fetch('/api/admin/session')
  } catch {
    return navigateTo({
      path: '/admin/login',
      query: { redirect: to.fullPath, reason: 'unauthorized' },
    })
  }
})
