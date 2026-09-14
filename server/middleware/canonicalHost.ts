import { canonicalStoreRedirect } from '#shared/storefrontSeo'

export default defineEventHandler((event) => {
  const redirect = canonicalStoreRedirect(getRequestURL(event))
  if (redirect) return sendRedirect(event, redirect, 308)
})
