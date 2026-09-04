import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { priceOrder } from '../shared/order.ts'
import {
  getStorefrontShippingRate,
  requireShippingRate,
  validateShippingZone,
} from '../server/services/shipping.ts'
import type { Catalog } from '../shared/types.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const catalog: Catalog = {
  demo: true, categories: [], products: [{ id: 'tee', slug: 'tee', code: 'TEE', category: 'tees',
    price: 890, image: '/tee.png', name: { en: 'Tee', ar: 'تيشرت' },
    description: { en: '', ar: '' }, detail: { en: '', ar: '' }, fit: { en: '', ar: '' },
    sizes: [{ name: 'M', stock: 3 }] }],
}

test('configured Cairo, Giza and another governorate produce server-owned totals', () => {
  assert.equal(priceOrder([{ id: 'tee', size: 'M', quantity: 1 }], catalog, 60).total, 950)
  assert.equal(priceOrder([{ id: 'tee', size: 'M', quantity: 1 }], catalog, 70).total, 960)
  assert.equal(priceOrder([{ id: 'tee', size: 'M', quantity: 1 }], catalog, 90).total, 980)
})

test('shipping validation accepts zero-rate pickup and rejects invalid rates', () => {
  assert.doesNotThrow(() => validateShippingZone({ governorate: 'Cairo', rate: 60, enabled: true }))
  assert.doesNotThrow(() => validateShippingZone({ governorate: 'Pickup', rate: 0, enabled: true }))
  assert.throws(() => validateShippingZone({ governorate: '', rate: 60, enabled: true }), /required/)
  assert.throws(() => validateShippingZone({ governorate: 'Delta', rate: -1, enabled: true }), /non-negative/)
  assert.throws(() => validateShippingZone({ governorate: 'Delta', rate: 50.5, enabled: true }), /whole EGP/)
})

test('disabled or unknown shipping zones are rejected by the shared service', async () => {
  const database = {
    prepare() {
      return { bind(governorate: unknown) { return { first: async () => governorate === 'Cairo'
        ? { governorate: 'Cairo', rate: 60, enabled: 1 } : null } } }
    },
  }
  assert.equal((await requireShippingRate(database as never, 'Cairo')).rate, 60)
  await assert.rejects(() => requireShippingRate(database as never, 'Alexandria'), /not available/)
})

test('standalone storefront retains original demo shipping without D1', async () => {
  assert.equal((await getStorefrontShippingRate(undefined, 'Cairo')).rate, 60)
  assert.equal((await getStorefrontShippingRate(undefined, 'Giza')).rate, 70)
  assert.equal((await getStorefrontShippingRate(undefined, 'Alexandria')).rate, 90)
  await assert.rejects(() => getStorefrontShippingRate(undefined, 'Unknown'), /not available/)
})

test('shipping APIs are protected for admin and public options expose enabled zones only', () => {
  for (const path of [
    '../server/api/admin/shipping/index.get.ts', '../server/api/admin/shipping/index.post.ts',
    '../server/api/admin/shipping/[governorate].get.ts', '../server/api/admin/shipping/[governorate].patch.ts',
  ]) assert.match(read(path), /requireAdmin\(event\)/, path)
  const publicOptions = read('../server/api/shipping/options.get.ts')
  assert.match(publicOptions, /database \? await listShippingZones\(database, true\) : demoShippingZones/)
})

test('storefront checkout and admin order use the same shipping source', () => {
  const checkoutPage = read('../app/pages/checkout.vue')
  const checkoutApi = read('../server/api/checkout.post.ts')
  const discountQuote = read('../server/api/discounts/quote.post.ts')
  const adminOrder = read('../server/services/createOrder.ts')
  assert.match(checkoutPage, /\/api\/shipping\/options/)
  assert.match(checkoutPage, /shippingGovernorate: form\.value\.city/)
  assert.doesNotMatch(checkoutPage, /const shipping = 60/)
  assert.match(checkoutApi, /getStorefrontShippingRate\(database/)
  assert.match(discountQuote, /getStorefrontShippingRate\(database/)
  assert.match(adminOrder, /listShippingZones\(database, true\)/)
  assert.match(adminOrder, /requireShippingRate\(database, input\.shippingGovernorate\)/)
})

test('shipping admin exposes list, create, edit, enable and disable states', () => {
  const list = read('../app/pages/admin/shipping/index.vue')
  const form = read('../app/components/admin/shipping/ShippingZoneForm.vue')
  for (const label of ['New zone', 'Edit', 'Disable', 'Enable', 'Rate', 'Enabled', 'Disabled']) assert.match(list, new RegExp(label))
  for (const field of ['Zone / governorate', 'Rate (EGP)', 'Available at checkout']) assert.match(form, new RegExp(field.replace(/[()]/g, '\\$&')))
  assert.match(list, /status === 'pending'/)
  assert.match(list, /v-else-if="error"/)
  assert.match(list, /v-else-if="!data\?\.items\.length"/)
})