import type { InventoryFilters, InventoryVariant } from '../../shared/inventory'
import type { D1Database } from '../utils/d1'

export const lowStockThreshold = 5

type InventoryRow = Omit<InventoryVariant, 'active' | 'lowStock'> & { active: number }

export async function listInventory(database: D1Database, filters: InventoryFilters = {}) {
  const conditions: string[] = []
  const values: unknown[] = []
  const query = filters.q?.trim()
  if (query) {
    conditions.push('(p.name_en LIKE ? OR v.sku LIKE ? OR v.size LIKE ? OR v.color LIKE ?)')
    const like = `%${query}%`
    values.push(like, like, like, like)
  }
  if (filters.category) {
    conditions.push('p.category = ?')
    values.push(filters.category)
  }
  if (filters.lowStock) {
    conditions.push('v.stock <= ?')
    values.push(lowStockThreshold)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const result = await database.prepare(`SELECT v.id, v.product_id AS productId,
    p.name_en AS productName, p.category, v.sku, v.size, v.color, v.stock, v.active,
    v.updated_at AS updatedAt FROM inventory_variants v JOIN products p ON p.id = v.product_id
    ${where} ORDER BY p.name_en, v.color, v.size`).bind(...values).all<InventoryRow>()
  return (result.results || []).map((item) => ({
    ...item,
    active: !!item.active,
    lowStock: item.stock <= lowStockThreshold,
  }))
}

export async function updateInventory(
  database: D1Database,
  id: string,
  stock: number,
  expectedStock: number,
) {
  if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a non-negative whole number.')
  if (!Number.isInteger(expectedStock) || expectedStock < 0) throw new Error('Current stock is invalid.')
  const updatedAt = new Date().toISOString()
  const result = await database.prepare(`UPDATE inventory_variants SET stock = ?, updated_at = ?
    WHERE id = ? AND stock = ?`).bind(stock, updatedAt, id, expectedStock).run()
  if (!result.meta?.changes) throw new Error('INVENTORY_CONFLICT')
  const updated = await database.prepare(`SELECT v.id, v.product_id AS productId,
    p.name_en AS productName, p.category, v.sku, v.size, v.color, v.stock, v.active,
    v.updated_at AS updatedAt FROM inventory_variants v JOIN products p ON p.id = v.product_id
    WHERE v.id = ?`).bind(id).first<InventoryRow>()
  if (!updated) throw new Error('VARIANT_NOT_FOUND')
  return { ...updated, active: !!updated.active, lowStock: updated.stock <= lowStockThreshold }
}

export async function deleteInventoryVariant(database: D1Database, id: string) {
  const cleanId = id.trim()
  if (!cleanId) throw new Error('VARIANT_DELETE_INVALID')

  const variant = await database.prepare(`SELECT v.id, v.product_id AS productId
    FROM inventory_variants v WHERE v.id = ?`).bind(cleanId).first<{
      id: string
      productId: string
    }>()
  if (!variant) throw new Error('VARIANT_NOT_FOUND')

  const used = await database.prepare('SELECT id FROM order_items WHERE variant_id = ? LIMIT 1')
    .bind(cleanId).first<{ id: string }>()
  if (used) throw new Error('VARIANT_DELETE_CONFLICT')

  const safeVariant = `EXISTS (SELECT 1 FROM inventory_variants v WHERE v.id = ?
    AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.variant_id = v.id))`
  const updatedAt = new Date().toISOString()
  const results = await database.batch([
    database.prepare(`UPDATE inventory_variants SET active = 0, updated_at = ?
      WHERE id = ? AND NOT EXISTS (SELECT 1 FROM order_items WHERE variant_id = ?)`)
      .bind(updatedAt, cleanId, cleanId),
    database.prepare(`UPDATE abandoned_carts SET
      subtotal = COALESCE((SELECT SUM(total) FROM abandoned_cart_items i
        WHERE i.cart_id = abandoned_carts.id AND i.variant_id <> ?), 0),
      items_count = COALESCE((SELECT SUM(quantity) FROM abandoned_cart_items i
        WHERE i.cart_id = abandoned_carts.id AND i.variant_id <> ?), 0),
      state = CASE WHEN NOT EXISTS (SELECT 1 FROM abandoned_cart_items i
        WHERE i.cart_id = abandoned_carts.id AND i.variant_id <> ?)
        THEN 'cleared' ELSE state END,
      version = version + 1,
      last_activity = ?
      WHERE state IN ('active', 'cleared')
        AND id IN (SELECT cart_id FROM abandoned_cart_items WHERE variant_id = ?)
        AND ${safeVariant}`)
      .bind(cleanId, cleanId, cleanId, updatedAt, cleanId, cleanId),
    database.prepare(`DELETE FROM abandoned_cart_items
      WHERE variant_id = ?
        AND cart_id IN (SELECT id FROM abandoned_carts WHERE state IN ('active', 'cleared'))
        AND ${safeVariant}`)
      .bind(cleanId, cleanId),
    database.prepare(`DELETE FROM inventory_variants WHERE id = ?
      AND NOT EXISTS (SELECT 1 FROM order_items WHERE variant_id = ?)`)
      .bind(cleanId, cleanId),
    database.prepare(`UPDATE products SET active = 0, updated_at = ?
      WHERE id = ? AND active = 1
        AND NOT EXISTS (SELECT 1 FROM inventory_variants WHERE id = ?)
        AND NOT EXISTS (SELECT 1 FROM inventory_variants WHERE product_id = ? AND active = 1)`)
      .bind(updatedAt, variant.productId, cleanId, variant.productId),
  ])

  if ((results[3]?.meta?.changes || 0) !== 1) throw new Error('VARIANT_DELETE_CONFLICT')
  return {
    deleted: true as const,
    id: cleanId,
    removedFromCarts: Number(results[1]?.meta?.changes || 0),
    productArchived: (results[4]?.meta?.changes || 0) === 1,
  }
}
