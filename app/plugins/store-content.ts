import type { PublicStoreContent } from '#shared/storeContent'

export default defineNuxtPlugin(async () => {
  const content = useStoreContent()
  try {
    const { data } = await useFetch<PublicStoreContent>('/api/storefront/content', {
      key: 'published-store-content',
    })
    if (data.value) content.value = data.value.content
  } catch {
    // The compiled content keeps the storefront available during a temporary API outage.
  }
})
