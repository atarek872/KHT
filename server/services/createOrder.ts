import type { AdminOrderDetail, OrderSource } from '../../shared/adminOrder'
import type {
  CreateOrderInput,
  CreateOrderResources,
  OrderVariantOption,
  ShippingOption,
} from '../../shared/createOrder'
import type { D1Database } from '../utils/d1'
import { assertAvailableStock, calculateOrderTotal, groupOrderLines } from '../../shared/order.ts'
import { getAdminOrder } from './adminOrders.ts'
import { quoteDiscount } from './discounts.ts'
import { listShippingZones, requireShippingRate } from './shipping.ts'

const sources: OrderSource[] = [
  'website', 'instagram', 'facebook', 'tiktok', 'whatsapp', 'phone', 'admin', 'other',
]

export function normalizeEgyptianPhone(value: string) {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  const easternDigits = '۰۱۲۳۴۵۶۷۸۹'
  let digits = value.trim().replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabicDigits.indexOf(digit)
    return String(arabicIndex >= 0 ? arabicIndex : easternDigits.indexOf(digit))
  }).replace(/\D/g, '')
  if (digits.startsWith('0020')) digits = digits.slice(2)
  if (/^01[0125]\d{8}$/.test(digits)) digits = `20${digits.slice(1)}`
  if (!/^201[0125]\d{8}$/.test(digits)) {
    throw new Error('Enter a valid Egyptian mobile number.')
  }
  return digits
}

export function prepareOrder(
  input: CreateOrderInput,
  variants: OrderVariantOption[],
  shipping: ShippingOption,
) {
  if (!input.requestId || input.requestId.length > 100) throw new Error('Invalid order request.')
  if (!input.customer.name.trim() || !input.customer.phone.trim() || !input.customer.address.trim()) {
    throw new Error('Customer name, phone and address are required.')
  }
  normalizeEgyptianPhone(input.customer.phone)
  if (!input.customer.governorate.trim() || !input.customer.city.trim()) {
    throw new Error('Governorate and city are required.')
  }
  if (input.paymentMethod !== 'cod') throw new Error('Only COD is supported for manual orders.')
  if (!sources.includes(input.source)) throw new Error('Choose a valid order source.')
  if (shipping.governorate !== input.shippingGovernorate) throw new Error('Shipping zone is unavailable.')

  const grouped = groupOrderLines(
    input.items.map((item) => ({ key: item.variantId, quantity: item.quantity })),
    20,
  )
  const lines = [...grouped].map(([variantId, quantity]) => {
    const variant = variants.find((item) => item.id === variantId)
    if (!variant) throw new Error('A selected variant is unavailable.')
    assertAvailableStock(quantity, variant.stock)
    return { variant, quantity, total: variant.unitPrice * quantity }
  })
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  return { lines, subtotal, shipping: shipping.rate, discount: 0,
    total: calculateOrderTotal(subtotal, 0, shipping.rate) }
}

export async function getCreateOrderResources(database: D1Database): Promise<CreateOrderResources> {
  const [variantsResult, shipping] = await Promise.all([
    database.prepare(`SELECT id, product_id AS productId, product_name AS productName, sku, size,
      color, unit_price AS unitPrice, stock FROM inventory_variants WHERE active = 1 ORDER BY product_name, size`).all<OrderVariantOption>(),
    listShippingZones(database, true),
  ])
  return {
    variants: variantsResult.results || [],
    shipping,
    paymentMethods: [{ value: 'cod', label: 'Cash on delivery' }],
    sources,
  }
}

export async function quoteOrder(database: D1Database, input: CreateOrderInput) {
  const resources = await getCreateOrderResources(database)
  const zone = await requireShippingRate(database, input.shippingGovernorate)
  const priced = prepareOrder(input, resources.variants, zone)
  const coupon = await quoteDiscount(database, priced.subtotal, input.couponCode)
  return {
    ...priced,
    discount: coupon.discount,
    total: calculateOrderTotal(priced.subtotal, coupon.discount, priced.shipping),
    couponCode: coupon.coupon?.code,
    discountId: coupon.coupon?.id,
  }
}

interface DurableOrderOptions {
  cartId?: string
  actorEmail?: string
}

export async function createDurableOrder(
  database: D1Database,
  input: CreateOrderInput,
  options: DurableOrderOptions = {},
): Promise<{ order: AdminOrderDetail; publicReference: string }> {
  if (options.cartId && !options.cartId.match(/^[a-f0-9-]{20,80}$/i)) {
    throw new Error('Invalid cart identifier.')
  }
  const duplicate = await database.prepare(`SELECT id, public_reference AS publicReference
    FROM orders WHERE idempotency_key = ?`)
    .bind(input.requestId).first<{ id: string; publicReference: string }>()
  if (duplicate) {
    const existing = await getAdminOrder(duplicate.id, database)
    if (existing.order) return { order: existing.order, publicReference: duplicate.publicReference }
    throw new Error('DUPLICATE_ORDER_REQUEST')
  }
  const priced = await quoteOrder(database, input)
  const phoneNormalized = normalizeEgyptianPhone(input.customer.phone)
  const existingCustomer = input.customer.id
    ? await database.prepare('SELECT id FROM customers WHERE id = ?').bind(input.customer.id).first<{ id: string }>()
    : await database.prepare('SELECT id FROM customers WHERE phone_normalized = ?')
        .bind(phoneNormalized).first<{ id: string }>()
  const customerId = existingCustomer?.id || crypto.randomUUID()
  const orderId = crypto.randomUUID()
  const orderNumber = `KHT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
  const publicReference = `KHT-${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`
  const createdAt = new Date().toISOString()
  const createdEventId = crypto.randomUUID()
  const customerStatement = existingCustomer
    ? database.prepare(`UPDATE customers SET name = ?, phone = ?, phone_normalized = ?, email = ?,
      address = ?, governorate = ?, city = ? WHERE id = ?`)
      .bind(input.customer.name.trim(), input.customer.phone.trim(), phoneNormalized,
        input.customer.email?.trim() || null, input.customer.address.trim(),
        input.customer.governorate.trim(), input.customer.city.trim(), customerId)
    : database.prepare(`INSERT INTO customers
      (id, name, phone, phone_normalized, email, address, governorate, city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(customerId, input.customer.name.trim(), input.customer.phone.trim(), phoneNormalized,
          input.customer.email?.trim() || null, input.customer.address.trim(),
          input.customer.governorate.trim(), input.customer.city.trim())
  const statements = [
    customerStatement,
    database.prepare(`INSERT INTO orders
      (id, number, public_reference, idempotency_key, customer_id, subtotal, shipping,
       shipping_governorate, discount, total, payment_method, source, notes, created_at,
       discount_id, discount_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', ?, ?, ?, ?, ?)`).bind(orderId, orderNumber,
        publicReference, input.requestId, customerId, priced.subtotal, priced.shipping,
        input.shippingGovernorate, priced.discount, priced.total, input.source,
        input.notes?.trim() || null, createdAt, priced.discountId || null,
        priced.couponCode || null),
    ...priced.lines.map((line) => database.prepare(`INSERT INTO order_items
      (id, order_id, variant_id, product_name, variant, sku, quantity, unit_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), orderId, line.variant.id, line.variant.productName,
        `${line.variant.color} / ${line.variant.size}`, line.variant.sku, line.quantity, line.variant.unitPrice, line.total)),
    database.prepare(`INSERT INTO order_events
      (id, order_id, event_type, to_value, actor_email, created_at)
      VALUES (?, ?, 'created', 'pending', ?, ?)`).bind(
        createdEventId, orderId, options.actorEmail || 'system@kht.local', createdAt,
      ),
  ]
  if (options.cartId) {
    statements.push(database.prepare(`UPDATE abandoned_carts SET state = 'converted',
      recovery_state = 'converted', recovered_order_id = ?, recovered_at = ?,
      last_activity = ? WHERE id = ?`).bind(orderId, createdAt, createdAt, options.cartId))
  }
  await database.batch(statements)
  const order: AdminOrderDetail = {
    id: orderId, number: orderNumber, customerName: input.customer.name.trim(), customerPhone: input.customer.phone.trim(),
    customerEmail: input.customer.email?.trim() || undefined, address: `${input.customer.address.trim()}, ${input.customer.city}, ${input.customer.governorate}`,
    subtotal: priced.subtotal, shipping: priced.shipping, discount: priced.discount, total: priced.total,
    discountCode: priced.couponCode,
    paymentMethod: 'cod', paymentStatus: 'pending', fulfillmentStatus: 'pending', source: input.source,
    notes: input.notes?.trim() || undefined, createdAt,
    lines: priced.lines.map((line) => ({ id: line.variant.id, productName: line.variant.productName,
      variant: `${line.variant.color} / ${line.variant.size}`, quantity: line.quantity,
      unitPrice: line.variant.unitPrice, total: line.total })),
    events: [{
      id: createdEventId, eventType: 'created', toValue: 'pending',
      actorEmail: options.actorEmail || 'system@kht.local', createdAt,
    }],
    allowedFulfillmentTransitions: ['confirmed', 'cancelled'],
    canRestockReturned: false,
  }
  return { order, publicReference }
}

export async function createOrder(
  database: D1Database,
  input: CreateOrderInput,
): Promise<AdminOrderDetail> {
  return (await createDurableOrder(database, input)).order
}
