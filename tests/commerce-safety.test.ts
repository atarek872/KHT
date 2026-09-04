import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { calculateOrderTotal } from '../shared/order.ts'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1')
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const files = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name)
  return statSync(path).isDirectory() ? files(path) : [path]
})

test('the shared total rejects invalid amounts and calculates subtotal minus discount plus shipping', () => {
  assert.equal(calculateOrderTotal(1780, 100, 60), 1740)
  assert.equal(calculateOrderTotal(1780, 0, 70), 1850)
  assert.throws(() => calculateOrderTotal(100, 101, 60), /cannot exceed/)
  assert.throws(() => calculateOrderTotal(100, -1, 60), /non-negative/)
})

test('all server quote paths call the same total function', () => {
  for (const path of [
    '../server/services/createOrder.ts',
    '../server/api/checkout.post.ts',
    '../server/api/discounts/quote.post.ts',
  ]) assert.match(read(path), /calculateOrderTotal\(/, path)
})

test('manual orders are COD-only and begin pending collection', () => {
  const types = read('../shared/adminOrder.ts')
  const service = read('../server/services/createOrder.ts')
  const schema = read('../server/db/migrations/0001_commerce.sql')
  const guards = read('../server/db/migrations/0006_commerce_safety.sql')
  assert.match(types, /OrderPaymentMethod = 'cod'/)
  assert.doesNotMatch(types, /OrderPaymentMethod[^\n]*paymob/)
  assert.match(service, /paymentMethod: 'cod', paymentStatus: 'pending'/)
  assert.match(schema, /payment_method TEXT NOT NULL CHECK \(payment_method = 'cod'\)/)
  assert.match(schema, /payment_status TEXT NOT NULL DEFAULT 'pending'/)
  assert.match(guards, /INVALID_COD_PAYMENT_STATUS/)
})

test('durable order creation is idempotent and inventory is database guarded', () => {
  const service = read('../server/services/createOrder.ts')
  const schema = read('../server/db/migrations/0001_commerce.sql')
  assert.match(service, /WHERE idempotency_key = \?/)
  assert.match(service, /if \(existing\.order\) return existing\.order/)
  assert.match(service, /await database\.batch\(statements\)/)
  assert.match(schema, /idempotency_key TEXT NOT NULL UNIQUE/)
  assert.match(schema, /RAISE\(ABORT, 'INSUFFICIENT_STOCK'\)/)
  assert.match(schema, /stock = stock - NEW\.quantity/)
})

test('database guards totals, discount amounts, shipping rates, statuses, and variant prices', () => {
  const migration = read('../server/db/migrations/0006_commerce_safety.sql')
  for (const guard of [
    'INVALID_ORDER_TOTAL', 'INVALID_COD_PAYMENT_STATUS', 'INVALID_PAYMENT_STATUS',
    'INVALID_FULFILLMENT_STATUS', 'INVALID_DISCOUNT_AMOUNT', 'INVALID_SHIPPING_RATE',
    'STALE_VARIANT_PRICE', 'INVALID_LINE_TOTAL',
  ]) assert.match(migration, new RegExp(guard), guard)
})

test('Paymob is absent rather than treated as an unverified payment integration', () => {
  const serverFiles = files(join(root, 'server')).map((path) => path.toLowerCase())
  assert.equal(serverFiles.some((path) => /paymob|webhook|callback/.test(path)), false)
  const client = files(join(root, 'app')).map((path) => readFileSync(path, 'utf8')).join('\n')
  assert.doesNotMatch(client, /window\.location|location\.href|paymentStatus\s*=|payment_status\s*=/)
})

test('client sources contain no payment credentials or secret-like literals', () => {
  const clientSources = [
    ...files(join(root, 'app')),
    join(root, 'nuxt.config.ts'),
    join(root, '.env.example'),
  ].map((path) => readFileSync(path, 'utf8')).join('\n')
  assert.doesNotMatch(
    clientSources,
    /PAYMOB_(?:API|SECRET|HMAC)|API_KEY|apiKey|secretKey|sk_live|pk_live|Bearer\s+[A-Za-z0-9_-]{20,}|hmac_secret/,
  )
})