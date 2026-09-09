import assert from 'node:assert/strict'
const base = 'http://127.0.0.1:8787'
function browser() {
  const cookies = new Map()
  return {
    cookies,
    async call(path, method = 'GET', body, expected = 200, origin = base) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      })
      for (const cookie of response.headers.getSetCookie()) {
        const [entry] = cookie.split(';')
        const at = entry.indexOf('=')
        cookies.set(entry.slice(0, at), entry.slice(at + 1))
      }
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
      assert.equal(
        response.status,
        expected,
        `${method} ${path}: ${JSON.stringify(data).slice(0, 400)}`,
      )
      return { data, response }
    },
  }
}
const a = browser(),
  b = browser(),
  run = crypto.randomUUID().slice(0, 8)
const password = 'Test customer password 2026!'
const { data: catalog } = await a.call('/api/catalog')
const product = catalog.products.find((p) => p.sizes.some((s) => s.stock >= 3))
assert.ok(product, 'Local catalog needs one stocked product')
const size = product.sizes.find((s) => s.stock >= 3).name
const items = [{ id: product.id, size, quantity: 1 }]
await a.call('/api/cart/snapshot', 'PUT', { cartId: crypto.randomUUID(), items })
const { data: registration, response } = await a.call('/api/account/register', 'POST', {
  name: 'Flow Test',
  email: `flow-${run}@example.test`,
  phone: '01012345678',
  password,
})
assert.ok(
  response.headers.getSetCookie().some((c) => c.includes('HttpOnly') && c.includes('SameSite=Lax')),
)
let { data: cart } = await a.call('/api/cart/merge', 'POST', { items })
assert.equal(cart.items[0].quantity, 1)
const duplicateMerge = await a.call('/api/cart/merge', 'POST', { items })
assert.equal(duplicateMerge.data.items[0].quantity, 1)
cart = (await a.call('/api/cart', 'PUT', { ...cart, items: [{ ...items[0], quantity: 2 }] })).data
await a.call('/api/cart', 'PUT', { ...cart, version: cart.version - 1, items: [] }, 409)
await a.call('/api/account/logout', 'POST', {})
assert.equal((await a.call('/api/account/session')).data.user, null)
await a.call('/api/account/login', 'POST', { email: registration.user.email, password })
cart = (await a.call('/api/cart')).data
assert.equal(cart.items[0].quantity, 2, 'Cart survives logout/login')
const address = {
  label: 'Home',
  name: 'Flow Test',
  phone: '01012345678',
  address: 'Test street 10',
  city: 'Nasr City',
  governorate: 'Cairo',
  isDefault: true,
}
const addressId = (await a.call('/api/account/addresses', 'POST', address)).data.address.id
const requestId = crypto.randomUUID()
const checkout = {
  ...address,
  email: registration.user.email,
  shippingGovernorate: 'Cairo',
  requestId,
  confirmed: true,
  paymentMethod: 'cod',
  cartId: cart.id,
  cartVersion: cart.version,
  expectedTotal: cart.subtotal + 60,
  items: cart.items,
}
const order = (await a.call('/api/checkout/order', 'POST', checkout)).data
assert.equal(
  (await a.call('/api/checkout/order', 'POST', checkout)).data.id,
  order.id,
  'Checkout retry must not duplicate order',
)
const detail = (await a.call(`/api/account/orders/${order.id}`)).data.order
assert.equal(detail.number, order.number)
assert.equal(detail.lines[0].quantity, 2)
assert.equal(detail.history[0].status, 'pending')
assert.equal(detail.paymentStatus, 'pending')
assert.ok((await a.call('/api/account/orders')).data.items.some((o) => o.id === order.id))
assert.equal((await a.call('/api/cart')).data.items.length, 0, 'Successful checkout converts cart')
await b.call('/api/account/register', 'POST', {
  name: 'Other',
  email: `other-${run}@example.test`,
  phone: '01012345678',
  password,
})
await b.call(`/api/account/orders/${order.id}`, 'GET', undefined, 404)
await b.call(`/api/account/addresses/${addressId}`, 'PATCH', address, 404)
await a.call(
  '/api/account/profile',
  'PATCH',
  { name: 'Changed', email: registration.user.email, phone: '01012345678' },
  403,
  'https://untrusted.example',
)
await a.call('/api/account/password', 'POST', {
  currentPassword: password,
  password: password + 'new',
})
assert.equal(
  (await a.call('/api/account/session')).data.user,
  null,
  'Password change revokes current session',
)
await a.call('/api/account/login', 'POST', { email: registration.user.email, password }, 401)
await a.call('/api/account/login', 'POST', {
  email: registration.user.email,
  password: password + 'new',
})
// Preserve both guest checkout contracts after integrating customer accounts.
const guest = browser()
const guestOrder = (
  await guest.call('/api/checkout/order', 'POST', {
    ...checkout,
    requestId: crypto.randomUUID(),
    items,
    expectedTotal: product.price + 60,
  })
).data
await guest.call(`/api/guest-orders/${guestOrder.id}`)
await b.call(`/api/guest-orders/${guestOrder.id}`, 'GET', undefined, 404)
const storefrontGuest = browser()
const storefrontCartId = crypto.randomUUID()
await storefrontGuest.call('/api/cart/snapshot', 'PUT', { cartId: storefrontCartId, items })
const storefrontOrder = (
  await storefrontGuest.call('/api/checkout', 'POST', {
    requestId: crypto.randomUUID(),
    cartId: storefrontCartId,
    customer: {
      name: 'Guest Production',
      phone: '01012345679',
      email: `guest-${run}@example.test`,
      address: '20 Guest Street',
      governorate: 'Cairo',
      city: 'Nasr City',
    },
    items,
    shippingGovernorate: 'Cairo',
    paymentMethod: 'cod',
  })
).data
assert.ok(storefrontOrder.reference)
await storefrontGuest.call(`/api/orders/${encodeURIComponent(storefrontOrder.reference)}`)
console.log(
  'PASS: register, guest merge retry, cart save, stale write, logout/login, restore, address, checkout retry, owned order/history, foreign account isolation, CSRF, password revocation, and both guest COD flows.',
)
