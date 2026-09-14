import { DEFAULT_STORE_CONTENT, cloneStoreContent } from '#shared/storeContent'

export function useStoreContent() {
  return useState('storefront-content', () => cloneStoreContent(DEFAULT_STORE_CONTENT))
}
