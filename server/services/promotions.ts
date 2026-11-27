import type { D1Database } from '../utils/d1'
import { activeStorePromotion, DEFAULT_PROMOTION } from '../../shared/promotion.ts'
import { getPublicStoreContent } from './storeContent.ts'

export async function getActiveStorePromotion(database: D1Database, now = new Date()) {
  try {
    const { content } = await getPublicStoreContent(database)
    return activeStorePromotion(content.brand.promotion, now)
  } catch (error) {
    if (error instanceof Error && /no such table: storefront_content_state/.test(error.message))
      return activeStorePromotion(DEFAULT_PROMOTION, now)
    throw error
  }
}
