export default defineNuxtRouteMiddleware(async (to) => {
  const customer = useCustomer()
  try {
    if (await customer.refresh()) return
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'Unable to check your account. Please try again.',
    })
  }
  return navigateTo({ path: '/account/login', query: { returnTo: to.fullPath } })
})
