export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin') || to.path === '/admin/login') return
  try {
    const request = import.meta.server ? useRequestFetch() : $fetch
    await request('/api/admin/session')
  } catch {
    return navigateTo({
      path: '/admin/login',
      query: { redirect: to.fullPath, reason: 'unauthorized' },
    })
  }
})