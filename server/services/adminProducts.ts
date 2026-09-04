import type { AdminProduct, AdminProductInput, AdminProductSummary, AdminProductVariant } from '../../shared/adminProduct'
import type { D1Database } from '../utils/d1'

type ProductSummaryRow = Omit<AdminProductSummary, 'name' | 'active'> & {
  nameEn: string
  nameAr: string
  active: number
}

type ProductVariantRow = Omit<AdminProductVariant, 'active'> & { active: number }

export function validateProduct(input: AdminProductInput, categories = new Set(['tees', 'sets', 'pants'])) {
  if (!input.slug?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) throw new Error('Use a lowercase URL slug with hyphens.')
  if (!input.code?.trim()) throw new Error('Product code is required.')
  if (!categories.has(input.category)) throw new Error('Choose an existing category.')
  if (!Number.isInteger(input.price) || input.price < 0) throw new Error('Enter a valid whole EGP price.')
  if (!input.image?.startsWith('/')) throw new Error('Upload or choose a valid product image.')
  for (const value of [input.name.en, input.name.ar, input.description.en, input.description.ar,
    input.detail.en, input.detail.ar, input.fit.en, input.fit.ar]) {
    if (!value?.trim()) throw new Error('Complete all English and Arabic product content.')
  }
  if (!input.variants.length) throw new Error('Add at least one variant.')
  const skus = new Set<string>()
  const activeSizes = new Set<string>()
  for (const variant of input.variants) {
    if (!variant.sku?.trim() || !variant.size?.trim() || !variant.color?.trim()) throw new Error('Every variant needs SKU, size, and color.')
    if (!Number.isInteger(variant.stock) || variant.stock < 0) throw new Error('Variant stock must be a non-negative whole number.')
    const sku = variant.sku.trim().toUpperCase()
    if (skus.has(sku)) throw new Error('Variant SKUs must be unique.')
    skus.add(sku)
    const size = variant.size.trim().toUpperCase()
    if (variant.active && activeSizes.has(size))
      throw new Error('The storefront supports one active variant per size.')
    if (variant.active) activeSizes.add(size)
  }
}

export async function listProducts(database: D1Database): Promise<AdminProductSummary[]> {
  const result = await database.prepare(`SELECT p.id, p.slug, p.code, p.name_en AS nameEn,
    p.name_ar AS nameAr, p.category, p.price, p.image, p.active, p.updated_at AS updatedAt,
    COALESCE(SUM(CASE WHEN v.active = 1 THEN v.stock ELSE 0 END), 0) AS stock
    FROM products p LEFT JOIN inventory_variants v ON v.product_id = p.id
    GROUP BY p.id ORDER BY p.updated_at DESC`).all<ProductSummaryRow>()
  return (result.results || []).map((item) => ({ ...item, name: { en: item.nameEn, ar: item.nameAr }, active: !!item.active }))
}

export async function getProduct(database: D1Database, id: string): Promise<AdminProduct | null> {
  const product = await database.prepare(`SELECT id, slug, code, category, price, image,
    name_en AS nameEn, name_ar AS nameAr, description_en AS descriptionEn,
    description_ar AS descriptionAr, detail_en AS detailEn, detail_ar AS detailAr,
    fit_en AS fitEn, fit_ar AS fitAr, active, updated_at AS updatedAt FROM products WHERE id = ?`)
    .bind(id).first<Record<string, string | number>>()
  if (!product) return null
  const variants = await database.prepare(`SELECT id, sku, size, color, stock, active
    FROM inventory_variants WHERE product_id = ? ORDER BY rowid`).bind(id)
    .all<ProductVariantRow>()
  return {
    id: String(product.id), slug: String(product.slug), code: String(product.code), category: String(product.category),
    price: Number(product.price), image: String(product.image), active: !!product.active, updatedAt: String(product.updatedAt),
    name: { en: String(product.nameEn), ar: String(product.nameAr) },
    description: { en: String(product.descriptionEn), ar: String(product.descriptionAr) },
    detail: { en: String(product.detailEn), ar: String(product.detailAr) },
    fit: { en: String(product.fitEn), ar: String(product.fitAr) },
    variants: (variants.results || []).map((variant) => ({ ...variant, active: !!variant.active })),
  }
}

export async function saveProduct(
  database: D1Database,
  input: AdminProductInput,
  id: string = crypto.randomUUID(),
) {
  const categoryRows = await database.prepare('SELECT slug FROM categories').all<{ slug: string }>()
  validateProduct(input, new Set((categoryRows.results || []).map((category) => category.slug)))
  const existing = await getProduct(database, id)
  const allowedIds = new Set(existing?.variants.map((variant) => variant.id) || [])
  if (input.variants.some((variant) => variant.id && !allowedIds.has(variant.id))) throw new Error('A variant does not belong to this product.')
  const now = new Date().toISOString()
  const productStatement = database.prepare(`INSERT INTO products
    (id, slug, code, category, price, image, name_en, name_ar, description_en, description_ar, detail_en, detail_ar, fit_en, fit_ar, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, code=excluded.code, category=excluded.category,
    price=excluded.price, image=excluded.image, name_en=excluded.name_en, name_ar=excluded.name_ar,
    description_en=excluded.description_en, description_ar=excluded.description_ar,
    detail_en=excluded.detail_en, detail_ar=excluded.detail_ar, fit_en=excluded.fit_en,
    fit_ar=excluded.fit_ar, active=excluded.active, updated_at=excluded.updated_at`)
    .bind(id, input.slug, input.code.trim(), input.category, input.price, input.image, input.name.en.trim(), input.name.ar.trim(),
      input.description.en.trim(), input.description.ar.trim(), input.detail.en.trim(), input.detail.ar.trim(),
      input.fit.en.trim(), input.fit.ar.trim(), input.active ? 1 : 0, now)
  const statements = [productStatement]
  if (existing) statements.push(database.prepare('UPDATE inventory_variants SET active = 0, updated_at = ? WHERE product_id = ?').bind(now, id))
  for (const variant of input.variants) {
    const variantId = variant.id || crypto.randomUUID()
    statements.push(database.prepare(`INSERT INTO inventory_variants
      (id, product_id, product_name, sku, size, color, unit_price, stock, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET product_name=excluded.product_name, sku=excluded.sku,
      size=excluded.size, color=excluded.color, unit_price=excluded.unit_price,
      active=excluded.active, updated_at=excluded.updated_at`).bind(variantId, id, input.name.en.trim(),
        variant.sku.trim().toUpperCase(), variant.size.trim(), variant.color.trim(), input.price,
        variant.stock, variant.active ? 1 : 0, now))
  }
  await database.batch(statements)
  return (await getProduct(database, id))!
}

export async function archiveProduct(database: D1Database, id: string) {
  const now = new Date().toISOString()
  await database.batch([
    database.prepare('UPDATE products SET active = 0, updated_at = ? WHERE id = ?').bind(now, id),
    database.prepare('UPDATE inventory_variants SET active = 0, updated_at = ? WHERE product_id = ?').bind(now, id),
  ])
}

export async function duplicateProduct(database: D1Database, id: string) {
  const source = await getProduct(database, id)
  if (!source) throw new Error('Product not found.')
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase()
  return saveProduct(database, {
    ...source, slug: `${source.slug}-copy-${suffix.toLowerCase()}`, code: `${source.code}-COPY-${suffix}`,
    active: false, variants: source.variants.map((variant) => ({ ...variant, id: undefined, sku: `${variant.sku}-COPY-${suffix}`, stock: 0 })),
  })
}