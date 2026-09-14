import type { PublicStoreContent } from '#shared/storeContent'

export default defineNuxtPlugin(async () => {
  const content = useStoreContent()
  try {
    const result = await $fetch<PublicStoreContent>('/api/storefront/content')
    content.value = result.content
  } catch {
    // The compiled content keeps the storefront available during a temporary API outage.
  }
})
