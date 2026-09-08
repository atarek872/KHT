import { accountBody, getCustomer, rateLimit } from '../../utils/customerAuth'
import { requireDatabase } from '../../utils/d1'
import { guestCartHash } from '../../utils/cartIdentity'
import {
  getSavedCart,
  cartVariants,
  validateCartItems,
  writeSavedCart,
} from '../../services/customerCarts'
import { createOrder } from '../../services/createOrder'
import { field, normalizeEmail } from '../../services/customerAccounts'
import { digest } from '../../utils/password'

export default defineEventHandler(async (event) => {
  const body = await accountBody(event)
  await rateLimit(event, 'checkout')
  const database = requireDatabase(event)
  const user = await getCustomer(event)
  const guestHash = user ? null : await guestCartHash(event)
  if (
    typeof body.requestId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(body.requestId) ||
    body.paymentMethod !== 'cod' ||
    body.confirmed !== true
  )
    throw createError({ statusCode: 400, statusMessage: 'Confirm your order and payment method.' })
  const requestId = await digest(`website:${user?.id || guestHash}:${body.requestId}`)
  // Retries resolve before reading the now-converted cart; the idempotency key is owner scoped.
  const existing = await database
    .prepare('SELECT id,number FROM orders WHERE idempotency_key=?')
    .bind(requestId)
    .first<{ id: string; number: string }>()
  if (existing) return existing
  try {
    const name = field(body.name, 'name', 100)
    const email = user?.email || normalizeEmail(body.email)
    const phone = field(body.phone, 'phone', 20)
    if (
      !/^\+?[0-9 ()-]{7,20}$/.test(phone) ||
      phone.replace(/\D/g, '').length < 7 ||
      phone.replace(/\D/g, '').length > 15
    )
      throw new Error('Enter a valid phone number.')
    const address = field(body.address, 'address', 250)
    const governorate = field(body.shippingGovernorate, 'governorate', 80)
    const city = field(body.city, 'city', 100)
    const owner = user ? { user } : { guestHash: guestHash! }
    let cart = await getSavedCart(database, owner)
    if (!user)
      cart = await writeSavedCart(database, owner, {
        ...cart,
        items: validateCartItems(body.items),
      })
    else if (body.cartId !== cart.id || body.cartVersion !== cart.version)
      throw new Error('Your bag changed. Reload it and review the total.')
    const variants = await cartVariants(database)
    const items = cart.items.map((line) => {
      const variant = variants.find((v) => v.productId === line.id && v.size === line.size)
      if (!variant) throw new Error('An item is unavailable. Review your bag.')
      return { variantId: variant.id, quantity: line.quantity }
    })
    const order = await createOrder(
      database,
      {
        requestId,
        customer: { name, email, phone, address, city, governorate },
        items,
        shippingGovernorate: governorate,
        paymentMethod: 'cod',
        source: 'website',
        couponCode: typeof body.couponCode === 'string' ? body.couponCode : undefined,
      },
      {
        userId: user?.id || null,
        cartId: cart.id,
        cartVersion: cart.version,
        expectedTotal: Number(body.expectedTotal),
      },
    )
    return { id: order.id, number: order.number }
  } catch (error) {
    // Concurrent double submissions may lose the unique-key race after the first request commits.
    const duplicate = await database
      .prepare('SELECT id,number FROM orders WHERE idempotency_key=?')
      .bind(requestId)
      .first<{ id: string; number: string }>()
    if (duplicate) return duplicate
    const message = error instanceof Error ? error.message : ''
    throw createError({
      statusCode: 409,
      statusMessage: /SQLITE|D1|CONSTRAINT|CART_CHANGED|STOCK|VARIANT/.test(message)
        ? 'Your bag or availability changed. Review it and try again.'
        : message || 'Your order could not be created. Please retry.',
    })
  }
})
