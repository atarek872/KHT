import type { D1Database } from '../utils/d1'

export async function isMediaReferenced(database: D1Database, url: string) {
  const reference = await database
    .prepare(
      `SELECT 1 AS used FROM (
    SELECT image AS url FROM products
    UNION ALL SELECT url FROM product_images
    UNION ALL SELECT image AS url FROM categories
    UNION ALL SELECT image_url AS url FROM store_curtain_settings WHERE image_url IS NOT NULL
  ) WHERE url = ?
  UNION ALL SELECT 1 AS used FROM storefront_content_state
    WHERE instr(draft_json, ?) > 0 OR instr(published_json, ?) > 0
  UNION ALL SELECT 1 AS used FROM storefront_content_versions
    WHERE instr(content_json, ?) > 0
  LIMIT 1`,
    )
    .bind(url, url, url, url)
    .first<{ used: number }>()
  return !!reference
}
