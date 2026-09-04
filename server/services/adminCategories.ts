import type { AdminCategory, AdminCategoryInput } from '../../shared/adminCategory'
import type { D1Database } from '../utils/d1'

type CategoryRow = Omit<AdminCategory, 'name' | 'active'> & {
  nameEn: string
  nameAr: string
  active: number
}

export function validateCategory(input: AdminCategoryInput) {
  if (!input.slug?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) throw new Error('Use a lowercase URL slug with hyphens.')
  if (!input.name?.en?.trim() || !input.name?.ar?.trim()) throw new Error('English and Arabic names are required.')
  if (!input.image?.startsWith('/')) throw new Error('Upload or choose a valid category image.')
  if (!Number.isInteger(input.sortOrder)) throw new Error('Sort order must be a whole number.')
}

const mapCategory = (row: CategoryRow): AdminCategory => ({
  ...row,
  name: { en: row.nameEn, ar: row.nameAr },
  active: !!row.active,
})

export async function listCategories(database: D1Database) {
  const result = await database.prepare(`SELECT c.id, c.slug, c.name_en AS nameEn,
    c.name_ar AS nameAr, c.image, c.active, c.sort_order AS sortOrder,
    c.updated_at AS updatedAt, COUNT(p.id) AS productCount
    FROM categories c LEFT JOIN products p ON p.category = c.slug
    GROUP BY c.id ORDER BY c.sort_order, c.name_en`).all<CategoryRow>()
  return (result.results || []).map(mapCategory)
}

export async function getCategory(database: D1Database, id: string) {
  const row = await database.prepare(`SELECT c.id, c.slug, c.name_en AS nameEn,
    c.name_ar AS nameAr, c.image, c.active, c.sort_order AS sortOrder,
    c.updated_at AS updatedAt, COUNT(p.id) AS productCount
    FROM categories c LEFT JOIN products p ON p.category = c.slug
    WHERE c.id = ? GROUP BY c.id`).bind(id).first<CategoryRow>()
  return row ? mapCategory(row) : null
}

export async function saveCategory(
  database: D1Database,
  input: AdminCategoryInput,
  id: string = crypto.randomUUID(),
) {
  validateCategory(input)
  const existing = await getCategory(database, id)
  const updatedAt = new Date().toISOString()
  const statements = [database.prepare(`INSERT INTO categories
    (id, slug, name_en, name_ar, image, active, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, name_en=excluded.name_en,
    name_ar=excluded.name_ar, image=excluded.image, active=excluded.active,
    sort_order=excluded.sort_order, updated_at=excluded.updated_at`).bind(
      id, input.slug, input.name.en.trim(), input.name.ar.trim(), input.image,
      input.active ? 1 : 0, input.sortOrder, updatedAt,
    )]
  if (existing && existing.slug !== input.slug) {
    statements.push(database.prepare('UPDATE products SET category = ?, updated_at = ? WHERE category = ?')
      .bind(input.slug, updatedAt, existing.slug))
  }
  await database.batch(statements)
  return (await getCategory(database, id))!
}

export async function deleteCategory(database: D1Database, id: string) {
  const category = await getCategory(database, id)
  if (!category) throw new Error('CATEGORY_NOT_FOUND')
  if (category.productCount > 0) throw new Error('CATEGORY_IN_USE')
  await database.prepare('DELETE FROM categories WHERE id = ?').bind(id).run()
}