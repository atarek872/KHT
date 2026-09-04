import type { Discount, DiscountInput, DiscountQuote } from '../../shared/discount'
import type { D1Database } from '../utils/d1'

type DiscountRow = Omit<Discount, 'active'> & { active: number }
const mapDiscount = (row: DiscountRow): Discount => ({ ...row, active: !!row.active })

export function validateDiscount(input: DiscountInput) {
  if (!input.code?.trim().match(/^[A-Z0-9][A-Z0-9_-]{2,31}$/)) throw new Error('Use 3–32 uppercase letters, numbers, hyphens, or underscores.')
  if (!['percentage', 'fixed'].includes(input.type)) throw new Error('Choose a valid discount type.')
  if (!Number.isInteger(input.value) || input.value <= 0) throw new Error('Discount value must be a positive whole number.')
  if (input.type === 'percentage' && input.value > 100) throw new Error('Percentage discounts cannot exceed 100%.')
  for (const [label, value] of [['Minimum order', input.minimumOrder], ['Maximum discount', input.maximumDiscount], ['Usage limit', input.usageLimit]] as const) {
    if (value != null && (!Number.isInteger(value) || value <= 0)) throw new Error(`${label} must be a positive whole number.`)
  }
  if (input.type === 'fixed' && input.maximumDiscount != null) throw new Error('Maximum discount applies only to percentage coupons.')
  if (input.validFrom && Number.isNaN(new Date(input.validFrom).getTime())) throw new Error('Valid from is not a valid date.')
  if (input.validUntil && Number.isNaN(new Date(input.validUntil).getTime())) throw new Error('Valid until is not a valid date.')
  if (input.validFrom && input.validUntil && new Date(input.validFrom) > new Date(input.validUntil)) throw new Error('Valid until must be after valid from.')
}

export function calculateDiscount(subtotal: number, discount: Discount, now = new Date()): DiscountQuote {
  if (!discount.active) throw new Error('This coupon is inactive.')
  if (discount.validFrom && now < new Date(discount.validFrom)) throw new Error('This coupon is not active yet.')
  if (discount.validUntil && now > new Date(discount.validUntil)) throw new Error('This coupon has expired.')
  if (discount.usageLimit != null && discount.currentUsage >= discount.usageLimit) throw new Error('This coupon has reached its usage limit.')
  if (discount.minimumOrder != null && subtotal < discount.minimumOrder) throw new Error(`This coupon requires a minimum order of ${discount.minimumOrder} EGP.`)
  let amount = discount.type === 'percentage' ? Math.floor((subtotal * discount.value) / 100) : discount.value
  if (discount.maximumDiscount != null) amount = Math.min(amount, discount.maximumDiscount)
  return { code: discount.code, discount: Math.min(amount, subtotal) }
}

export async function listDiscounts(database: D1Database) {
  const result = await database.prepare(`SELECT id, code, type, value,
    minimum_order AS minimumOrder, maximum_discount AS maximumDiscount,
    usage_limit AS usageLimit, current_usage AS currentUsage,
    valid_from AS validFrom, valid_until AS validUntil, active,
    updated_at AS updatedAt FROM discounts ORDER BY updated_at DESC`).all<DiscountRow>()
  return (result.results || []).map(mapDiscount)
}

export async function getDiscount(database: D1Database, id: string) {
  const row = await database.prepare(`SELECT id, code, type, value,
    minimum_order AS minimumOrder, maximum_discount AS maximumDiscount,
    usage_limit AS usageLimit, current_usage AS currentUsage,
    valid_from AS validFrom, valid_until AS validUntil, active,
    updated_at AS updatedAt FROM discounts WHERE id = ?`).bind(id).first<DiscountRow>()
  return row ? mapDiscount(row) : null
}

export async function findDiscountByCode(database: D1Database, code?: string) {
  if (!code?.trim()) return null
  const row = await database.prepare(`SELECT id, code, type, value,
    minimum_order AS minimumOrder, maximum_discount AS maximumDiscount,
    usage_limit AS usageLimit, current_usage AS currentUsage,
    valid_from AS validFrom, valid_until AS validUntil, active,
    updated_at AS updatedAt FROM discounts WHERE code = ?`).bind(code.trim().toUpperCase()).first<DiscountRow>()
  return row ? mapDiscount(row) : null
}

export async function saveDiscount(
  database: D1Database,
  input: DiscountInput,
  id: string = crypto.randomUUID(),
) {
  const normalized = { ...input, code: input.code.trim().toUpperCase() }
  validateDiscount(normalized)
  const existing = await getDiscount(database, id)
  const updatedAt = new Date().toISOString()
  await database.prepare(`INSERT INTO discounts
    (id, code, type, value, minimum_order, maximum_discount, usage_limit, current_usage,
     valid_from, valid_until, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET code=excluded.code, type=excluded.type, value=excluded.value,
    minimum_order=excluded.minimum_order, maximum_discount=excluded.maximum_discount,
    usage_limit=excluded.usage_limit, valid_from=excluded.valid_from,
    valid_until=excluded.valid_until, active=excluded.active, updated_at=excluded.updated_at`)
    .bind(id, normalized.code, normalized.type, normalized.value, normalized.minimumOrder ?? null,
      normalized.type === 'percentage' ? normalized.maximumDiscount ?? null : null,
      normalized.usageLimit ?? null, existing?.currentUsage || 0, normalized.validFrom || null,
      normalized.validUntil || null, normalized.active ? 1 : 0, updatedAt).run()
  return (await getDiscount(database, id))!
}

export async function quoteDiscount(database: D1Database, subtotal: number, code?: string) {
  if (!code?.trim()) return { discount: 0, coupon: null }
  const coupon = await findDiscountByCode(database, code)
  if (!coupon) throw new Error('Coupon code was not found.')
  return { ...calculateDiscount(subtotal, coupon), coupon }
}