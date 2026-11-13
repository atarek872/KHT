import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createTestD1 } from './helpers/sqliteD1.ts'
import { createStorefrontOrder } from '../server/services/storefrontCheckout.ts'
import { getAdminOrder } from '../server/services/adminOrders.ts'
import {
  deliverMetaOutbox,
  normalizeMetaEmail,
  normalizeMetaPhone,
  postMetaEvent,
  purchaseMetaEvent,
  safeMetaIdentifier,
  sha256Hex,
} from '../server/services/metaCapi.ts'
import {
  deliverGa4Outbox,
  ga4ClientId,
  ga4SessionId,
  purchaseGa4Payload,
} from '../server/services/ga4Purchase.ts'
import { campaignFromQuery } from '../shared/campaignAttribution.ts'
import type { StorefrontCheckoutInput } from '../shared/storefrontOrder.ts'

const migrations = [
  '0001_commerce.sql',
  '0002_products.sql',
  '0003_categories.sql',
  '0004_discounts.sql',
  '0005_abandoned_carts.sql',
  '0006_commerce_safety.sql',
  '0007_production_commerce.sql',
  '0015_order_campaign.sql',
  '0016_meta_attribution.sql',
  '0017_shipping_product_proof.sql',
].map((name) => new URL(`../server/db/migrations/${name}`, import.meta.url))

function setup() {
  const result = createTestD1()
  for (const migration of migrations) result.sqlite.exec(readFileSync(migration, 'utf8'))
  return result
}

function checkoutInput(): StorefrontCheckoutInput {
  return {
    requestId: crypto.randomUUID(),
    cartId: crypto.randomUUID(),
    customer: {
      name: 'Mariam Hassan',
      phone: '01010000001',
      email: ' Mariam@Example.test ',
      address: '12 Street',
      governorate: 'Cairo',
      city: 'Nasr City',
    },
    items: [{ id: 'kht-001', size: 'M', quantity: 2 }],
    shippingGovernorate: 'Cairo',
    paymentMethod: 'cod',
    attribution: campaignFromQuery({
      utm_source: 'facebook',
      utm_medium: 'paid_social',
      utm_campaign: 'drop_001',
      utm_content: 'video_a',
      utm_term: 'hoodie',
      utm_id: 'utm_42',
      campaign_id: '123456',
      adset_id: '789012',
      ad_id: '345678',
      fbclid: 'click_123',
    }),
  }
}

test('attribution preserves all campaign and ad identifiers but rejects unsafe values', () => {
  const attribution = checkoutInput().attribution!
  assert.equal(attribution.source, 'facebook')
  assert.equal(attribution.utmId, 'utm_42')
  assert.equal(attribution.campaignId, '123456')
  assert.equal(attribution.adsetId, '789012')
  assert.equal(attribution.adId, '345678')
  assert.equal(attribution.fbclid, 'click_123')
  assert.equal(campaignFromQuery({ fbclid: 'bad@email' })?.fbclid, undefined)
  assert.equal(safeMetaIdentifier('fb.1.1760000000.12345678', 'fbp'), 'fb.1.1760000000.12345678')
  assert.equal(safeMetaIdentifier('bad cookie', 'fbc'), undefined)
})

test('Meta purchase uses server merchandise value and normalized SHA-256 customer hashes', async () => {
  assert.equal(normalizeMetaEmail(' Mariam@Example.test '), 'mariam@example.test')
  assert.equal(normalizeMetaPhone('01010000001'), '201010000001')
  const payload = await purchaseMetaEvent({
    reference: 'KHT-REF-1',
    createdAt: '2026-11-13T12:00:00.000Z',
    lines: [
      {
        variant: {
          id: 'variant-1',
          productId: 'product-1',
          productCode: 'KHT-001',
          productName: 'KHT Set',
          sku: 'KHT-M',
          size: 'M',
          color: 'Black',
          unitPrice: 1000,
          stock: 5,
        },
        quantity: 2,
      },
    ],
    subtotal: 2000,
    discount: 200,
    customer: { email: ' Mariam@Example.test ', phone: '01010000001' },
    context: {
      eventSourceUrl: 'https://kht-eg.com/checkout',
      ip: '203.0.113.4',
      userAgent: 'Test Browser',
      fbp: 'fb.1.1760000000.12345678',
      fbc: 'fb.1.1760000000.click_123',
    },
  })
  assert.equal(payload.event_name, 'Purchase')
  assert.equal(payload.event_id, 'KHT-REF-1')
  assert.equal(payload.action_source, 'website')
  assert.equal(payload.custom_data.value, 1800)
  assert.deepEqual(payload.custom_data.content_ids, ['KHT-001'])
  assert.equal(payload.custom_data.num_items, 2)
  assert.equal(payload.user_data.em?.[0], await sha256Hex('mariam@example.test'))
  assert.equal(payload.user_data.ph?.[0], await sha256Hex('201010000001'))
  assert.doesNotMatch(JSON.stringify(payload), /Mariam@|01010000001/)
})

test('GA4 purchase separates discount-adjusted item value and shipping', () => {
  assert.equal(ga4ClientId('GA1.1.123456.789012', 'fallback'), '123456.789012')
  assert.equal(ga4SessionId('GS2.1.s1760000000$o1$g1'), 'GS2.1.s1760000000$o1$g1')
  assert.equal(ga4SessionId('GS1.1.1760000000.1.1.1760000020.0.0.0'), 'GS1.1.1760000000.1.1.1760000020.0.0.0')
  assert.equal(ga4SessionId('bad\nvalue'), undefined)
  const payload = purchaseGa4Payload({
    reference: 'KHT-REF-1',
    createdAt: '2026-11-13T12:00:00.000Z',
    clientId: '123456.789012',
    sessionId: ga4SessionId('GS2.1.s1760000000$o1$g1'),
    subtotal: 2000,
    discount: 200,
    shipping: 85,
    couponCode: 'WELCOME10',
    lines: [
      {
        variant: {
          id: 'variant-1',
          productId: 'product-1',
          productCode: 'KHT-001',
          productName: 'KHT Set',
          sku: 'KHT-M',
          size: 'M',
          color: 'Black',
          unitPrice: 1000,
          stock: 5,
        },
        quantity: 2,
      },
    ],
  })
  const params = payload.events[0].params
  assert.equal(params.transaction_id, 'KHT-REF-1')
  assert.equal(params.value, 1800)
  assert.equal(params.shipping, 85)
  assert.equal(params.coupon, 'WELCOME10')
  assert.equal(params.session_id, 'GS2.1.s1760000000$o1$g1')
  assert.equal(params.items[0].discount, 100)
})

test('successful UTM order atomically queues one Purchase per platform across retries', async () => {
  const { database, sqlite, close } = setup()
  try {
    const input = checkoutInput()
    const context = {
      eventSourceUrl: 'https://kht-eg.com/checkout',
      ip: '203.0.113.4',
      userAgent: 'Test Browser',
      gaCookie: 'GA1.1.123456.789012',
      gaSessionCookie: 'GS2.1.s1760000000$o1$g1',
    }
    const first = await createStorefrontOrder(database, input, context)
    const retry = await createStorefrontOrder(database, input, context)
    assert.equal(first.reference, retry.reference)
    const order = sqlite
      .prepare(
        `SELECT campaign_attribution AS attribution,
      attribution_campaign_id AS campaignId, attribution_adset_id AS adsetId,
      attribution_ad_id AS adId FROM orders`,
      )
      .get() as Record<string, string>
    assert.equal(JSON.parse(order.attribution).utmId, 'utm_42')
    assert.equal(order.campaignId, '123456')
    assert.equal(order.adsetId, '789012')
    assert.equal(order.adId, '345678')
    assert.equal(
      (sqlite.prepare('SELECT count(*) AS count FROM orders').get() as { count: number }).count,
      1,
    )
    assert.equal(
      (sqlite.prepare('SELECT count(*) AS count FROM meta_event_outbox').get() as { count: number })
        .count,
      1,
    )
    assert.equal(
      (
        sqlite.prepare('SELECT count(*) AS count FROM ga4_purchase_outbox').get() as {
          count: number
        }
      ).count,
      1,
    )
    const meta = JSON.parse(
      (
        sqlite.prepare('SELECT payload_json AS payload FROM meta_event_outbox').get() as {
          payload: string
        }
      ).payload,
    )
    const ga4 = JSON.parse(
      (
        sqlite.prepare('SELECT payload_json AS payload FROM ga4_purchase_outbox').get() as {
          payload: string
        }
      ).payload,
    )
    assert.equal(meta.event_id, first.reference)
    assert.equal(meta.custom_data.value, first.subtotal - first.discount)
    assert.equal(ga4.events[0].params.transaction_id, first.reference)
    assert.equal(ga4.events[0].params.value, first.subtotal - first.discount)
    assert.equal(ga4.events[0].params.session_id, 'GS2.1.s1760000000$o1$g1')
    const orderId = (sqlite.prepare('SELECT id FROM orders').get() as { id: string }).id
    const adminDetail = (await getAdminOrder(orderId, database)).order
    assert.equal(adminDetail?.publicReference, first.reference)
    assert.equal(adminDetail?.attribution?.adsetId, '789012')
    assert.equal(adminDetail?.metaDeliveryStatus, 'pending')
    assert.equal(adminDetail?.ga4DeliveryStatus, 'pending')
  } finally {
    close()
  }
})

test('concurrent order submissions keep one order and one Purchase per platform', async () => {
  const { database, sqlite, close } = setup()
  try {
    const input = checkoutInput()
    const context = { eventSourceUrl: 'https://kht-eg.com/checkout' }
    const results = await Promise.allSettled([
      createStorefrontOrder(database, input, context),
      createStorefrontOrder(database, input, context),
    ])
    assert.ok(results.some((result) => result.status === 'fulfilled'))
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    if (fulfilled.length === 2) assert.equal(fulfilled[0]!.value.reference, fulfilled[1]!.value.reference)
    for (const table of ['orders', 'meta_event_outbox', 'ga4_purchase_outbox']) {
      assert.equal(
        (sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count,
        1,
      )
    }
  } finally {
    close()
  }
})

test('Meta API failure retries without blocking the order or logging secrets', async () => {
  const { database, sqlite, close } = setup()
  const warning = console.warn
  const messages: string[] = []
  console.warn = (...parts) => {
    messages.push(JSON.stringify(parts))
  }
  try {
    const order = await createStorefrontOrder(database, checkoutInput(), {
      eventSourceUrl: 'https://kht-eg.com/checkout',
      ip: '203.0.113.4',
      userAgent: 'Test Browser',
    })
    const config = { pixelId: '1603918338193891', apiVersion: 'v27.0', accessToken: 'secret-token' }
    const failed = await deliverMetaOutbox(database, config, {
      eventName: 'Purchase',
      eventId: order.reference,
      send: async () => new Response('failure', { status: 503 }),
    })
    assert.equal(failed.retried, 1)
    assert.equal(
      (sqlite.prepare('SELECT attempts FROM meta_event_outbox').get() as { attempts: number })
        .attempts,
      1,
    )
    sqlite.exec("UPDATE meta_event_outbox SET next_attempt_at='2000-01-01T00:00:00.000Z'")
    let sends = 0
    const sent = await deliverMetaOutbox(database, config, {
      eventName: 'Purchase',
      eventId: order.reference,
      send: async (_url, init) => {
        sends++
        assert.equal(JSON.parse(String(init?.body)).data[0].event_id, order.reference)
        return Response.json({ events_received: 1 })
      },
    })
    assert.equal(sent.delivered, 1)
    assert.equal(sends, 1)
    assert.equal(
      (
        await deliverMetaOutbox(database, config, {
          send: async () => {
            sends++
            return Response.json({ events_received: 1 })
          },
        })
      ).delivered,
      0,
    )
    assert.equal(sends, 1)
    assert.equal(
      (
        sqlite.prepare('SELECT payload_json AS payload FROM meta_event_outbox').get() as {
          payload: string | null
        }
      ).payload,
      null,
    )
    assert.doesNotMatch(messages.join(' '), /secret-token|Mariam|01010000001/)
  } finally {
    console.warn = warning
    close()
  }
})

test('GA4 API failure retries with the same transaction ID', async () => {
  const { database, sqlite, close } = setup()
  const warning = console.warn
  console.warn = () => undefined
  try {
    const order = await createStorefrontOrder(database, checkoutInput(), {
      eventSourceUrl: 'https://kht-eg.com/checkout',
      gaCookie: 'GA1.1.123456.789012',
    })
    const config = { measurementId: 'G-YHQBDWSBKG', apiSecret: 'ga-secret' }
    assert.equal(
      (
        await deliverGa4Outbox(database, config, {
          transactionId: order.reference,
          send: async () => new Response('', { status: 503 }),
        })
      ).retried,
      1,
    )
    sqlite.exec("UPDATE ga4_purchase_outbox SET next_attempt_at='2000-01-01T00:00:00.000Z'")
    let sends = 0
    assert.equal(
      (
        await deliverGa4Outbox(database, config, {
          transactionId: order.reference,
          send: async (_url, init) => {
            sends++
            assert.equal(
              JSON.parse(String(init?.body)).events[0].params.transaction_id,
              order.reference,
            )
            return new Response(null, { status: 204 })
          },
        })
      ).delivered,
      1,
    )
    assert.equal(sends, 1)
  } finally {
    console.warn = warning
    close()
  }
})

test('Meta API uses the configurable version and never puts the token in its URL', async () => {
  const payload = await purchaseMetaEvent({
    reference: 'KHT-REF-1',
    createdAt: '2026-11-13T12:00:00.000Z',
    lines: [],
    subtotal: 0,
    discount: 0,
    customer: {},
    context: { eventSourceUrl: 'https://kht-eg.com/checkout' },
  })
  payload.testEventCode = 'TEST37457'
  const accepted = await postMetaEvent(
    payload,
    { pixelId: '1603918338193891', apiVersion: 'v27.0', accessToken: 'secret-token' },
    async (url, init) => {
      assert.match(String(url), /\/v27\.0\/1603918338193891\/events$/)
      assert.doesNotMatch(String(url), /secret-token/)
      assert.equal(JSON.parse(String(init?.body)).access_token, 'secret-token')
      assert.equal(JSON.parse(String(init?.body)).test_event_code, 'TEST37457')
      assert.equal(JSON.parse(String(init?.body)).data[0].testEventCode, undefined)
      return Response.json({ events_received: 1 })
    },
  )
  assert.equal(accepted, true)
})
