import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { createOrder, normalizeAdminPhone, quoteOrder } from '../server/services/createOrder.ts'
import { exchangeOrderComponent } from '../server/services/orderExchanges.ts'
import { restockReturnedOrder, transitionOrder } from '../server/services/orderTransitions.ts'
import { createTestD1 } from './helpers/sqliteD1.ts'
import { getAdminOrder } from '../server/services/adminOrders.ts'
import { trackOrder } from '../server/services/storefrontOrders.ts'
import { updateInventory } from '../server/services/inventory.ts'

const migrationDirectory = new URL('../server/db/migrations/', import.meta.url)
const migrations = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()
const sharedMigration = '0024_shared_set_inventory.sql'

function makeFixture() {
  const fixture = createTestD1()
  for (const name of migrations.filter((name) => name !== sharedMigration))
    fixture.sqlite.exec(readFileSync(new URL(name, migrationDirectory), 'utf8'))
  const products = [
    ['test-set', 'line-01-full-set-black', 'full-sets', 'TEST-SET'],
    ['test-hoodie', 'line-01-oversized-hoodie-black', 'hoodies', 'TEST-HOODIE'],
    ['test-pants', 'line-01-wide-leg-pants-black', 'sweatpants', 'TEST-PANTS'],
  ] as const
  for (const [id, slug, category, code] of products) {
    fixture.sqlite
      .prepare(
        `INSERT INTO products
      (id,slug,code,category,price,image,name_en,name_ar,description_en,description_ar,detail_en,detail_ar,fit_en,fit_ar)
      SELECT ?,?,?,?,price,image,name_en,name_ar,description_en,description_ar,detail_en,detail_ar,fit_en,fit_ar
      FROM products WHERE id='kht-002'`,
      )
      .run(id, slug, code, category)
    for (const size of ['M', 'L']) {
      const stock =
        category === 'full-sets' ? 17 : category === 'hoodies' ? 24 : size === 'M' ? 24 : 25
      fixture.sqlite
        .prepare(
          `INSERT INTO inventory_variants
        (id,product_id,product_name,sku,size,color,unit_price,stock)
        VALUES(?,?,?,?,?,'Black',2050,?)`,
        )
        .run(`${id}-${size}`, id, code, `${code}-${size}`, size, stock)
    }
  }
  fixture.sqlite.exec(readFileSync(new URL(sharedMigration, migrationDirectory), 'utf8'))
  const stock = (id: string) =>
    (
      fixture.sqlite.prepare('SELECT stock FROM inventory_variants WHERE id=?').get(id) as {
        stock: number
      }
    ).stock
  return { ...fixture, stock }
}

test('production set reconciliation uses one hoodie and one pants per set', () => {
  const fixture = makeFixture()
  try {
    assert.equal(fixture.stock('test-hoodie-M'), 16)
    assert.equal(fixture.stock('test-pants-M'), 16)
    assert.equal(fixture.stock('test-set-M'), 16)
    assert.equal(fixture.stock('test-hoodie-L'), 16)
    assert.equal(fixture.stock('test-pants-L'), 17)
    assert.equal(fixture.stock('test-set-L'), 16)
  } finally {
    fixture.close()
  }
})

test('manual US order accepts a private discount and reserves both physical pieces', async () => {
  const fixture = makeFixture()
  try {
    const input = {
      requestId: crypto.randomUUID(),
      customer: {
        name: 'Friend',
        phone: '+1 (212) 555-0187',
        phoneCountry: 'US' as const,
        address: '12 Test Street',
        governorate: 'Cairo',
        city: 'Cairo',
      },
      items: [{ variantId: 'test-set-M', quantity: 1 }],
      shippingGovernorate: 'Cairo',
      paymentMethod: 'cod' as const,
      source: 'admin' as const,
      manualDiscountPercent: 10,
    }
    assert.equal(normalizeAdminPhone(input.customer.phone, 'US'), '12125550187')
    await assert.rejects(
      quoteOrder(fixture.database, input),
      /Manual discounts are available to admins only/,
    )
    const quoted = await quoteOrder(fixture.database, input, {
      allowInternationalPhone: true,
      allowManualDiscount: true,
    })
    assert.equal(quoted.discount, 205)
    const order = await createOrder(fixture.database, input, {
      allowInternationalPhone: true,
      allowManualDiscount: true,
      actorEmail: 'admin@example.com',
    })
    assert.equal(order.customerPhone, '+12125550187')
    assert.equal(order.discount, 205)
    assert.equal(order.manualDiscountPercent, 10)
    assert.equal(fixture.stock('test-hoodie-M'), 15)
    assert.equal(fixture.stock('test-pants-M'), 15)
    assert.equal(fixture.stock('test-set-M'), 15)
    const saved = fixture.sqlite
      .prepare('SELECT manual_discount_percent AS percent FROM orders WHERE id=?')
      .get(order.id) as { percent: number }
    assert.equal(saved.percent, 10)
    const reference = fixture.sqlite
      .prepare('SELECT public_reference AS reference FROM orders WHERE id=?')
      .get(order.id) as { reference: string }
    assert.equal(
      (await trackOrder(fixture.database, reference.reference, '+1 212 555 0187'))?.reference,
      reference.reference,
    )
    fixture.sqlite
      .prepare(
        `INSERT INTO customer_users(id,name,email,phone,password_hash)
      VALUES('later-account','Friend','friend@example.com',?,'placeholder')`,
      )
      .run(order.customerPhone)
    assert.equal(
      (
        fixture.sqlite
          .prepare('SELECT COUNT(*) AS count FROM customer_users WHERE phone=?')
          .get(order.customerPhone) as { count: number }
      ).count,
      1,
    )
  } finally {
    fixture.close()
  }
})

test('exchanging one set pant updates both size balances and cancellation restores the replacement', async () => {
  const fixture = makeFixture()
  try {
    const order = await createOrder(fixture.database, {
      requestId: crypto.randomUUID(),
      customer: {
        name: 'Exchange Test',
        phone: '01010000042',
        address: 'Test Street',
        city: 'Cairo',
        governorate: 'Cairo',
      },
      items: [{ variantId: 'test-set-M', quantity: 1 }],
      shippingGovernorate: 'Cairo',
      paymentMethod: 'cod',
      source: 'admin',
    })
    const line = fixture.sqlite
      .prepare('SELECT id FROM order_items WHERE order_id=?')
      .get(order.id) as { id: string }
    const requestId = crypto.randomUUID()
    const swap = {
      requestId,
      orderItemId: line.id,
      fromVariantId: 'test-pants-M',
      toVariantId: 'test-pants-L',
      quantity: 1,
      returnedReceived: false,
    }
    await exchangeOrderComponent(fixture.database, order.id, swap, 'admin@example.com')
    await exchangeOrderComponent(fixture.database, order.id, swap, 'admin@example.com')
    await assert.rejects(
      exchangeOrderComponent(
        fixture.database,
        order.id,
        { ...swap, quantity: 2 },
        'admin@example.com',
      ),
      /EXCHANGE_CONFLICT/,
    )
    assert.equal(fixture.stock('test-hoodie-M'), 15)
    assert.equal(fixture.stock('test-pants-M'), 16)
    assert.equal(fixture.stock('test-pants-L'), 16)
    assert.equal(fixture.stock('test-set-M'), 15)
    const allocations = fixture.sqlite
      .prepare(
        'SELECT variant_id AS id,quantity FROM order_item_components WHERE order_item_id=? ORDER BY variant_id',
      )
      .all(line.id)
    assert.deepEqual(
      allocations.map((row) => ({ ...row })),
      [
        { id: 'test-hoodie-M', quantity: 1 },
        { id: 'test-pants-L', quantity: 1 },
      ],
    )
    const detail = (await getAdminOrder(order.id, fixture.database)).order
    assert.deepEqual(
      detail?.lines[0]?.components?.map((part) => part.size),
      ['M', 'L'],
    )
    assert.ok(detail?.events.some((event) => event.eventType === 'component_exchanged'))
    await transitionOrder(fixture.database, order.id, 'cancelled', 'admin@example.com')
    assert.equal(fixture.stock('test-hoodie-M'), 16)
    assert.equal(fixture.stock('test-pants-M'), 16)
    assert.equal(fixture.stock('test-pants-L'), 17)
    assert.equal(fixture.stock('test-set-M'), 16)
  } finally {
    fixture.close()
  }
})

test('sets cannot be oversold or edited as independent stock', async () => {
  const fixture = makeFixture()
  try {
    await assert.rejects(
      updateInventory(fixture.database, 'test-set-M', 25, 16),
      /calculated from hoodie and pants/,
    )
    await updateInventory(fixture.database, 'test-hoodie-M', 0, 16)
    assert.equal(fixture.stock('test-set-M'), 0)
    await assert.rejects(
      createOrder(fixture.database, {
        requestId: crypto.randomUUID(),
        customer: {
          name: 'No Stock',
          phone: '01010000044',
          address: 'Test Street',
          city: 'Cairo',
          governorate: 'Cairo',
        },
        items: [{ variantId: 'test-set-M', quantity: 1 }],
        shippingGovernorate: 'Cairo',
        paymentMethod: 'cod',
        source: 'admin',
      }),
      /stock/i,
    )
  } finally {
    fixture.close()
  }
})

test('a set and a standalone hoodie share the same available units at quote time', async () => {
  const fixture = makeFixture()
  try {
    await assert.rejects(
      quoteOrder(fixture.database, {
        requestId: crypto.randomUUID(),
        customer: {
          name: 'Mixed Cart',
          phone: '01010000045',
          address: 'Test Street',
          city: 'Cairo',
          governorate: 'Cairo',
        },
        items: [
          { variantId: 'test-set-M', quantity: 10 },
          { variantId: 'test-hoodie-M', quantity: 7 },
        ],
        shippingGovernorate: 'Cairo',
        paymentMethod: 'cod',
        source: 'admin',
      }),
      /selected set and separate pieces exceed available stock/,
    )
    assert.equal(fixture.stock('test-hoodie-M'), 16)
  } finally {
    fixture.close()
  }
})

test('a delivered set requires receipt before exchange and return restocks its final sizes once', async () => {
  const fixture = makeFixture()
  try {
    const order = await createOrder(fixture.database, {
      requestId: crypto.randomUUID(),
      customer: {
        name: 'Delivered Test',
        phone: '01010000043',
        address: 'Test Street',
        city: 'Cairo',
        governorate: 'Cairo',
      },
      items: [{ variantId: 'test-set-M', quantity: 1 }],
      shippingGovernorate: 'Cairo',
      paymentMethod: 'cod',
      source: 'admin',
    })
    for (const status of [
      'confirmed',
      'processing',
      'shipped',
      'out-for-delivery',
      'delivered',
    ] as const)
      await transitionOrder(fixture.database, order.id, status, 'admin@example.com')
    const line = fixture.sqlite
      .prepare('SELECT id FROM order_items WHERE order_id=?')
      .get(order.id) as { id: string }
    const swap = {
      requestId: crypto.randomUUID(),
      orderItemId: line.id,
      fromVariantId: 'test-pants-M',
      toVariantId: 'test-pants-L',
      quantity: 1,
      returnedReceived: false,
    }
    await assert.rejects(
      exchangeOrderComponent(fixture.database, order.id, swap, 'admin@example.com'),
      /EXCHANGE_RETURN_NOT_RECEIVED/,
    )
    assert.equal(fixture.stock('test-pants-M'), 15)
    await exchangeOrderComponent(
      fixture.database,
      order.id,
      { ...swap, returnedReceived: true },
      'admin@example.com',
    )
    assert.equal(fixture.stock('test-pants-M'), 16)
    assert.equal(fixture.stock('test-pants-L'), 16)
    await transitionOrder(fixture.database, order.id, 'returned', 'admin@example.com')
    await restockReturnedOrder(fixture.database, order.id, 'admin@example.com')
    assert.equal(fixture.stock('test-hoodie-M'), 16)
    assert.equal(fixture.stock('test-pants-M'), 16)
    assert.equal(fixture.stock('test-pants-L'), 17)
    await assert.rejects(
      restockReturnedOrder(fixture.database, order.id, 'admin@example.com'),
      /ORDER_RESTOCK_CONFLICT/,
    )
  } finally {
    fixture.close()
  }
})
