import type { CreateOrderInput, OrderVariantOption } from '../../shared/createOrder.ts'
import type {
  StorefrontCheckoutInput,
  StorefrontOrderConfirmation,
} from '../../shared/storefrontOrder.ts'
import type { D1Database } from '../utils/d1.ts'
import { createDurableOrder, normalizeEgyptianPhone } from './createOrder.ts'

function requireText(value: unknown, label: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`)
  if (value.trim().length > maximum) throw new Error(`${label} is too long.`)
  return value.trim()
}

function validateCheckout(input: StorefrontCheckoutInput) {
  if (!input || typeof input !== 'object') throw new Error('Invalid checkout request.')
  if (!input.requestId?.match(/^[a-f0-9-]{20,80}$/i)) throw new Error('Invalid checkout request.')
  if (!input.cartId?.match(/^[a-f0-9-]{20,80}$/i)) throw new Error('Invalid cart identifier.')
  if (input.paymentMethod !== 'cod') {
    throw new Error('Cash on delivery is the only available payment method.')
  }
  requireText(input.customer?.name, 'Full name', 100)
  requireText(input.customer?.phone, 'Phone number', 30)
  normalizeEgyptianPhone(input.customer.phone)
  if (input.customer.email) {
    const email = input.customer.email.trim()
    if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid email address or leave it blank.')
    }
  }
  requireText(input.customer?.address, 'Street address', 250)
  requireText(input.customer?.governorate, 'Governorate', 80)
  requireText(input.customer?.city, 'City or area', 100)
  if (input.customer.governorate.trim() !== input.shippingGovernorate?.trim()) {
    throw new Error('Delivery governorate does not match the selected shipping option.')
  }
  if (input.notes && input.notes.trim().length > 500) throw new Error('Order notes are too long.')
  if (!Array.isArray(input.items)) throw new Error('Invalid bag contents.')
}

async function resolveStorefrontVariants(database: D1Database, input: StorefrontCheckoutInput) {
  const variants = await database
    .prepare(
      `SELECT v.id, v.product_id AS productId,
    v.product_name AS productName, v.sku, v.size, v.color, v.unit_price AS unitPrice, v.stock
    FROM inventory_variants v
    JOIN products p ON p.id = v.product_id
    JOIN categories c ON c.slug = p.category
    WHERE v.active = 1 AND p.active = 1 AND c.active = 1`,
    )
    .all<OrderVariantOption>()
  const available = variants.results || []
  return input.items.map((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.size !== 'string') {
      throw new Error('Invalid bag contents.')
    }
    const variant = available.find(
      (candidate) => candidate.productId === item.id && candidate.size === item.size,
    )
    if (!variant) throw new Error('A selected size is no longer available. Review your bag.')
    return { variantId: variant.id, quantity: item.quantity }
  })
}

export async function createStorefrontOrder(
  database: D1Database,
  input: StorefrontCheckoutInput,
): Promise<StorefrontOrderConfirmation> {
  validateCheckout(input)
  const orderInput: CreateOrderInput = {
    requestId: input.requestId,
    customer: {
      name: input.customer.name.trim(),
      phone: input.customer.phone.trim(),
      email: input.customer.email?.trim() || undefined,
      address: input.customer.address.trim(),
      governorate: input.customer.governorate.trim(),
      city: input.customer.city.trim(),
    },
    items: await resolveStorefrontVariants(database, input),
    shippingGovernorate: input.shippingGovernorate.trim(),
    paymentMethod: 'cod',
    source: 'website',
    couponCode: input.couponCode?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  }
  const { order, publicReference } = await createDurableOrder(database, orderInput, {
    cartId: input.cartId,
    actorEmail: 'storefront@kht.local',
  })
  return {
    reference: publicReference,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.address,
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount,
    total: order.total,
    discountCode: order.discountCode,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    createdAt: order.createdAt,
    lines: order.lines.map(({ productName, variant, quantity, unitPrice, total }) => ({
      productName,
      variant,
      quantity,
      unitPrice,
      total,
    })),
  }
}
