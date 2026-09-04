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