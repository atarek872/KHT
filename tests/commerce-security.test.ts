import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTestD1 } from './helpers/sqliteD1.ts'
import { consumeRateLimit } from '../server/utils/rateLimit.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('commerce mutations reject non-JSON and oversized bodies', () => {
  const guard = read('../server/utils/requestGuards.ts')
  assert.match(guard, /application\/json/)
  assert.match(guard, /content-length/i)
  assert.match(guard, /Payload is too large/)
  assert.match(guard, /readRawBody\(event\)/)
  assert.doesNotMatch(guard, /readRawBody\(event,\s*false\)/)

  for (const path of [
    '../server/api/admin/login.post.ts',
    '../server/api/checkout.post.ts',
    '../server/api/orders/track.post.ts',
    '../server/api/cart/snapshot.put.ts',
    '../server/api/admin/orders/[id].patch.ts',
    '../server/api/admin/orders/[id]/restock.post.ts',
    '../server/api/admin/abandoned-carts/[id].patch.ts',
  ]) {
    assert.match(read(path), /requireJsonBody/, path)
  }
})

test('public sensitive endpoints use D1-backed rate limits', () => {
  for (const path of [
    '../server/api/admin/login.post.ts',
    '../server/api/checkout.post.ts',
    '../server/api/orders/track.post.ts',
    '../server/api/cart/snapshot.put.ts',
    '../server/api/discounts/quote.post.ts',
  ]) {
    assert.match(read(path), /enforceRateLimit\(/, path)
  }
  const rateLimit = read('../server/utils/rateLimit.ts')
  assert.match(rateLimit, /SHA-256/)
  assert.match(rateLimit, /request_rate_limits/)
  assert.match(rateLimit, /\.bind\(keyHash/)
  assert.doesNotMatch(rateLimit, /\.bind\(connectingIp/)
})

test('fixed-window rate limits block excess requests and reset after expiry', async () => {
  const { database, sqlite, close } = createTestD1()
  sqlite.exec(`
    CREATE TABLE request_rate_limits (
      key_hash TEXT PRIMARY KEY,
      request_count INTEGER NOT NULL,
      expires_at TEXT NOT NULL
    );
  `)
  try {
    const now = new Date('2026-09-05T00:00:00.000Z')
    assert.equal((await consumeRateLimit(database, 'hashed-client', 2, 60, now)).allowed, true)
    assert.equal((await consumeRateLimit(database, 'hashed-client', 2, 60, now)).allowed, true)
    const blocked = await consumeRateLimit(database, 'hashed-client', 2, 60, now)
    assert.equal(blocked.allowed, false)
    assert.equal(blocked.retryAfter, 60)

    const reset = await consumeRateLimit(
      database,
      'hashed-client',
      2,
      60,
      new Date('2026-09-05T00:01:01.000Z'),
    )
    assert.equal(reset.allowed, true)
    assert.equal(reset.remaining, 1)
  } finally {
    close()
  }
})

test('security middleware sets a request id and restrictive browser headers', () => {
  const middleware = read('../server/middleware/securityHeaders.ts')
  for (const value of [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    "frame-ancestors 'none'",
    'X-Request-Id',
  ]) {
    assert.match(middleware, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), value)
  }
})
