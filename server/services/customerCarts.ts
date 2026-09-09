import type { D1Database, D1Statement } from '../utils/d1'
import type { CustomerUser } from '../../shared/account'
import type { CartLine } from '../../shared/types'
import type { SavedCart } from '../../shared/customerCart'
import { assertAvailableStock, groupOrderLines } from '../../shared/order.ts'

type Owner = { user: CustomerUser } | { guestHash: string }
type CartRow = { id: string; version: number; subtotal: number }
type Variant = {
  id: string
  productId: string
  size: string
  color: string
  stock: number
  unitPrice: number
  productName: string
  image: string
}

export async function cartVariants(database: D1Database) {
  const result = await database
    .prepare(
      `SELECT v.id,v.product_id AS productId,v.size,v.color,v.stock,
    v.unit_price AS unitPrice,p.name_en AS productName,p.image FROM inventory_variants v
    JOIN products p ON p.id=v.product_id JOIN categories c ON c.slug=p.category
    WHERE v.active=1 AND p.active=1 AND c.active=1`,
    )
    .all<Variant>()
  return result.results || []
}

export function validateCartItems(raw: unknown): CartLine[] {
  if (!Array.isArray(raw) || raw.length > 12)
    throw new Error('Your bag can contain up to 12 selections.')
  return raw.map((line) => {
    if (
      !line ||
      typeof line.id !== 'string' ||
      line.id.length > 100 ||
      line.id.includes(':') ||
      typeof line.size !== 'string' ||
      line.size.length > 30 ||
      line.size.includes(':') ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 10
    )
      throw new Error('Check the selections and quantities in your bag.')
    return { id: line.id, size: line.size, quantity: line.quantity }
  })
}

export function mergeCartItems(saved: CartLine[], guest: CartLine[], variants: Variant[]) {
  const grouped = new Map<string, CartLine>()
  for (const line of [...saved, ...guest]) {
    const key = `${line.id}:${line.size}`
    const prior = grouped.get(key)
    grouped.set(key, { ...line, quantity: (prior?.quantity || 0) + line.quantity })
  }
  if (grouped.size > 12)
    throw new Error('The merged bag exceeds 12 selections. Remove some guest items and try again.')
  return [...grouped.values()].flatMap((line) => {
    const variant = variants.find((v) => v.productId === line.id && v.size === line.size)
    const quantity = Math.min(line.quantity, variant?.stock || 0, 10)
    return quantity > 0 ? [{ ...line, quantity }] : []
  })
}

export async function getSavedCart(database: D1Database, owner: Owner): Promise<SavedCart> {
  const user = 'user' in owner ? owner.user : null
  const guestHash = 'guestHash' in owner ? owner.guestHash : null
  const predicate = user ? 'user_id = ?' : 'guest_key_hash = ? AND user_id IS NULL'
  const value = user?.id || guestHash
  let row = await database
    .prepare(
      `SELECT id,version,subtotal FROM abandoned_carts WHERE ${predicate}
    AND state IN ('active','cleared') ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(value)
    .first<CartRow>()
  if (!row) {
    const now = new Date().toISOString()
    await database
      .prepare(
        `INSERT OR IGNORE INTO abandoned_carts
      (id,user_id,guest_key_hash,state,customer_name,email,phone,created_at,last_activity)
      VALUES(?,?,?,'cleared',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        user?.id || null,
        guestHash,
        user?.name || null,
        user?.email || null,
        user?.phone || null,
        now,
        now,
      )
      .run()
    row = await database
      .prepare(
        `SELECT id,version,subtotal FROM abandoned_carts WHERE ${predicate}
      AND state IN ('active','cleared') ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(value)
      .first<CartRow>()
  }
  if (!row) throw new Error('Your bag could not be opened. Please retry.')
  const items = await database
    .prepare(
      `SELECT i.product_id AS id,v.size,i.quantity FROM abandoned_cart_items i
    JOIN inventory_variants v ON v.id=i.variant_id WHERE i.cart_id=? ORDER BY i.rowid`,
    )
    .bind(row.id)
    .all<CartLine>()
  return { ...row, items: items.results || [] }
}

export async function writeSavedCart(
  database: D1Database,
  owner: Owner,
  input: { id: string; version: number; items: unknown },
  mergeHash?: string,
): Promise<SavedCart> {
  if (!Number.isSafeInteger(input.version) || input.version < 0)
    throw new Error('Reload your bag and try again.')
  const cart = await getSavedCart(database, owner)
  if (cart.id !== input.id || cart.version !== input.version) throw new Error('CART_CHANGED')
  const items = validateCartItems(input.items)
  const variants = await cartVariants(database)
  const groups = items.length
    ? groupOrderLines(
        items.map((line) => ({ key: `${line.id}:${line.size}`, quantity: line.quantity })),
      )
    : new Map<string, number>()
  const lines = [...groups].map(([key, quantity]) => {
    const variant = variants.find((v) => `${v.productId}:${v.size}` === key)
    if (!variant) throw new Error('An item is no longer available. Review your bag.')
    assertAvailableStock(quantity, variant.stock)
    return { ...variant, quantity }
  })
  const user = 'user' in owner ? owner.user : null
  const writeToken = crypto.randomUUID()
  const now = new Date().toISOString()
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  const statements: D1Statement[] = [
    database
      .prepare(
        `UPDATE abandoned_carts SET version=version+1,write_token=?,
    subtotal=?,items_count=?,state=?,last_activity=?,customer_name=?,email=?,phone=?
    WHERE id=? AND version=? AND state IN ('active','cleared')`,
      )
      .bind(
        writeToken,
        subtotal,
        lines.reduce((sum, line) => sum + line.quantity, 0),
        lines.length ? 'active' : 'cleared',
        now,
        user?.name || null,
        user?.email || null,
        user?.phone || null,
        cart.id,
        input.version,
      ),
    database
      .prepare(
        `DELETE FROM abandoned_cart_items WHERE cart_id=? AND EXISTS
      (SELECT 1 FROM abandoned_carts WHERE id=? AND write_token=?)`,
      )
      .bind(cart.id, cart.id, writeToken),
    ...lines.map((line) =>
      database
        .prepare(
          `INSERT INTO abandoned_cart_items
      (id,cart_id,product_id,variant_id,product_name,variant,image,quantity,unit_price,total)
      SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM abandoned_carts WHERE id=? AND write_token=?)`,
        )
        .bind(
          crypto.randomUUID(),
          cart.id,
          line.productId,
          line.id,
          line.productName,
          `${line.color} / ${line.size}`,
          line.image,
          line.quantity,
          line.unitPrice,
          line.quantity * line.unitPrice,
          cart.id,
          writeToken,
        ),
    ),
  ]
  if (mergeHash && user)
    statements.push(
      database
        .prepare(
          `INSERT INTO cart_merge_receipts(guest_key_hash,user_id,cart_id,created_at)
    SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM abandoned_carts WHERE id=? AND write_token=?)`,
        )
        .bind(mergeHash, user.id, cart.id, now, cart.id, writeToken),
      database
        .prepare(
          `UPDATE abandoned_carts SET state='cleared',items_count=0,subtotal=0,version=version+1
      WHERE guest_key_hash=? AND user_id IS NULL AND state='active' AND EXISTS
      (SELECT 1 FROM abandoned_carts WHERE id=? AND write_token=?)`,
        )
        .bind(mergeHash, cart.id, writeToken),
    )
  const result = await database.batch(statements)
  if (!result[0]?.meta?.changes) throw new Error('CART_CHANGED')
  return {
    id: cart.id,
    version: cart.version + 1,
    subtotal,
    items: lines.map((l) => ({ id: l.productId, size: l.size, quantity: l.quantity })),
  }
}

export async function mergeGuestCart(
  database: D1Database,
  user: CustomerUser,
  guestHash: string,
  raw: unknown,
) {
  const receipt = await database
    .prepare('SELECT user_id FROM cart_merge_receipts WHERE guest_key_hash=?')
    .bind(guestHash)
    .first()
  const saved = await getSavedCart(database, { user })
  if (receipt) return saved
  const guest = validateCartItems(raw)
  const items = mergeCartItems(saved.items, guest, await cartVariants(database))
  try {
    const result = await writeSavedCart(database, { user }, { ...saved, items }, guestHash)
    return {
      ...result,
      adjusted: JSON.stringify(items) !== JSON.stringify([...saved.items, ...guest]),
    }
  } catch (error) {
    if (String(error).includes('UNIQUE')) return getSavedCart(database, { user })
    throw error
  }
}
