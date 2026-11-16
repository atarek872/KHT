import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { createTestD1 } from './helpers/sqliteD1.ts'
import {
  adminProductReviews,
  moderateProductReview,
  publicProductReviews,
  submitProductReview,
} from '../server/services/productReviews.ts'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import { transitionOrder } from '../server/services/orderTransitions.ts'
import { updateOrderSource } from '../server/services/orderSource.ts'

test('only a delivered buyer can submit one review, which stays hidden until approved', async () => {
  const fixture = createTestD1()
  try {
    const directory = new URL('../server/db/migrations/', import.meta.url)
    for (const name of readdirSync(directory)
      .filter((file) => file.endsWith('.sql'))
      .sort())
      fixture.sqlite.exec(readFileSync(new URL(name, directory), 'utf8'))
    const created = await createStorefrontOrder(fixture.database, {
      requestId: crypto.randomUUID(),
      cartId: crypto.randomUUID(),
      customer: {
        name: 'Review Buyer',
        phone: '01010000033',
        address: '12 Street',
        governorate: 'Cairo',
        city: 'Cairo',
      },
      items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
      shippingGovernorate: 'Cairo',
      paymentMethod: 'cod',
    })
    const saved = fixture.sqlite
      .prepare('SELECT id, public_reference AS reference FROM orders WHERE number=?')
      .get(created.number) as { id: string; reference: string }
    const input = {
      reference: saved.reference,
      phone: '01010000033',
      displayName: 'Review Buyer',
      rating: 5,
      body: 'The fit was comfortable and the fabric feels good.',
    }
    await assert.rejects(submitProductReview(fixture.database, 'kht-001', input), /delivered order/)
    for (const status of [
      'confirmed',
      'processing',
      'shipped',
      'out-for-delivery',
      'delivered',
    ] as const)
      await transitionOrder(fixture.database, saved.id, status, 'admin@test.local')
    await updateOrderSource(fixture.database, saved.id, 'instagram', 'admin@test.local')
    assert.equal(
      (
        fixture.sqlite.prepare('SELECT source FROM orders WHERE id=?').get(saved.id) as {
          source: string
        }
      ).source,
      'instagram',
    )
    assert.equal(
      (
        fixture.sqlite
          .prepare(
            "SELECT COUNT(*) AS count FROM order_events WHERE order_id=? AND event_type='source_changed'",
          )
          .get(saved.id) as { count: number }
      ).count,
      1,
    )
    await assert.rejects(
      submitProductReview(fixture.database, 'kht-001', { ...input, phone: '01010000034' }),
      /matching phone/,
    )
    await submitProductReview(fixture.database, 'kht-001', input)
    await assert.rejects(submitProductReview(fixture.database, 'kht-001', input), /already exists/)
    assert.equal((await publicProductReviews(fixture.database, 'kht-001')).count, 0)
    const pending = await adminProductReviews(fixture.database)
    assert.equal(pending.length, 1)
    assert.equal(pending[0]?.status, 'pending')
    await moderateProductReview(fixture.database, pending[0]!.id, 'approved', 'admin@test.local')
    const visible = await publicProductReviews(fixture.database, 'kht-001')
    assert.equal(visible.count, 1)
    assert.equal(visible.average, 5)
    assert.equal(visible.reviews[0]?.body, input.body)
    await moderateProductReview(fixture.database, pending[0]!.id, 'rejected', 'admin@test.local')
    assert.equal((await publicProductReviews(fixture.database, 'kht-001')).count, 0)
  } finally {
    fixture.close()
  }
})
