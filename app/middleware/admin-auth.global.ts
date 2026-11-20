export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin') || to.path === '/admin/login') return
  try {
    if (import.meta.server) {
      // The protected API validates the session. Avoid a nested API request during
      // SSR: Cloudflare's internal fetch can lose the request's D1 binding.
      if (!/(?:^|;\s*)kht-admin-session=/.test(useRequestHeaders(['cookie']).cookie || '')) {
        return navigateTo({
          path: '/admin/login',
          query: { redirect: to.fullPath, reason: 'unauthorized' },
        })
      }
      return
    } else {
      await $fetch('/api/admin/session')
    }
  } catch (cause: unknown) {
    const failure = cause as {
      statusCode?: number
      status?: number
      data?: { statusCode?: number }
    }
    const code = failure.statusCode || failure.status || failure.data?.statusCode
    if (code === 401) {
      return navigateTo({
        path: '/admin/login',
        query: { redirect: to.fullPath, reason: 'unauthorized' },
      })
    }
    throw cause
  }
})
