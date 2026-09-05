import type { D1Database } from '../utils/d1'

export async function isMediaReferenced(database: D1Database, url: string) {
  const reference = await database.prepare(`SELECT url FROM (
    SELECT image AS url FROM products
    UNION ALL SELECT url FROM product_images
    UNION ALL SELECT image AS url FROM categories
  ) WHERE url = ? LIMIT 1`).bind(url).first<{ url: string }>()
  return !!reference
}
