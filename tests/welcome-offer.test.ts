import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  WELCOME_DISCOUNT_CODE,
  resolveCustomerDiscountCode,
} from '../server/services/welcomeOffer.ts'
import { createOrder } from '../server/services/createOrder.ts'
import { getSavedCart, writeSavedCart } from '../server/services/customerCarts.ts'
import { testDatabase } from './d1-test-adapter.ts'

test('the welcome gift is automatic for a signed-in customer with no previous order', async () => {
  const { database, sql } = testDatabase()
  try {
    sql
      .prepare(
        `INSERT INTO customer_users(id,name,email,phone,password_hash)
       VALUES('new-user','New Customer','new@example.com','01000000000','hash')`,
      )
      .run()

    const user = {
      id: 'new-user',
      name: 'New Customer',
      email: 'new@example.com',
      phone: '01000000000',
    }
    const emptyCart = await getSavedCart(database, { user })
    const cart = await writeSavedCart(
      database,
      { user },
      {
        ...emptyCart,
        items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
      },
    )
    const input = {
      requestId: crypto.randomUUID(),
      customer: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: '12 First Order Street',
        governorate: 'Cairo',
        city: 'Cairo',
      },
      items: [{ variantId: 'kht-001-m', quantity: 1 }],
      shippingGovernorate: 'Cairo',
      paymentMethod: 'cod' as const,
      source: 'website' as const,
    }
    const order = await createOrder(database, input, {
      userId: user.id,
      cartId: cart.id,
      cartVersion: cart.version,
    })

    assert.equal(order.discountCode, WELCOME_DISCOUNT_CODE)
    assert.equal(order.discount, 44)
    assert.equal(order.total, 906)
    assert.equal(
      await resolveCustomerDiscountCode(database, {
        userId: user.id,
        automaticWelcome: true,
      }),
      undefined,
    )
  } finally {
    sql.close()
  }
})

test('the welcome gift cannot be used by guests or reused after a first order', async () => {
  const { database, sql } = testDatabase()
  try {
    sql
      .prepare(
        `INSERT INTO customer_users(id,name,email,phone,password_hash)
       VALUES('returning-user','Returning Customer','returning@example.com','01000000001','hash')`,
      )
      .run()
    sql
      .prepare(
        `INSERT INTO customers(id,name,phone,phone_normalized,email,address,governorate,city)
       VALUES('customer','Returning Customer','01000000001','201000000001','returning@example.com','Street','Cairo','Cairo')`,
      )
      .run()
    sql
      .prepare(
        `INSERT INTO orders
       (id,number,public_reference,idempotency_key,customer_id,subtotal,shipping,
        shipping_governorate,discount,total,payment_method,source,user_id,created_at)
       VALUES('first-order','KHT-FIRST','KHT-FIRST-PUBLIC','first-request','customer',1000,60,
        'Cairo',0,1060,'cod','website','returning-user','2026-09-14T00:00:00.000Z')`,
      )
      .run()

    assert.equal(
      await resolveCustomerDiscountCode(database, {
        userId: 'returning-user',
        automaticWelcome: true,
      }),
      undefined,
    )
    await assert.rejects(
      resolveCustomerDiscountCode(database, {
        userId: null,
        requestedCode: WELCOME_DISCOUNT_CODE,
      }),
      /signed-in first order/i,
    )
    await assert.rejects(
      resolveCustomerDiscountCode(database, {
        userId: 'returning-user',
        requestedCode: WELCOME_DISCOUNT_CODE,
      }),
      /signed-in first order/i,
    )
  } finally {
    sql.close()
  }
})

test('the database enforces one welcome gift per account', () => {
  const { sql } = testDatabase()
  try {
    const offer = sql
      .prepare('SELECT type,value,active FROM discounts WHERE code=?')
      .get(WELCOME_DISCOUNT_CODE) as { type: string; value: number; active: number }
    assert.deepEqual({ ...offer }, { type: 'percentage', value: 5, active: 1 })

    const migration = readFileSync(
      new URL('../server/db/migrations/0010_welcome_offer.sql', import.meta.url),
      'utf8',
    )
    assert.match(migration, /CREATE TRIGGER enforce_welcome_offer_before_order/)
    assert.match(migration, /NEW\.user_id IS NULL/)
    assert.match(migration, /orders existing WHERE existing\.user_id = NEW\.user_id/)
  } finally {
    sql.close()
  }
})

test('the welcome prompt stays out of checkout and preserves guest checkout', () => {
  const popup = readFileSync(new URL('../app/components/WelcomeGift.vue', import.meta.url), 'utf8')
  const checkout = readFileSync(new URL('../app/pages/checkout.vue', import.meta.url), 'utf8')
  const layout = readFileSync(new URL('../app/layouts/default.vue', import.meta.url), 'utf8')

  assert.match(popup, /30_000/)
  assert.match(popup, /60_000/)
  assert.match(popup, /30 \* 24 \* 60 \* 60 \* 1000/)
  assert.match(popup, /\/checkout/)
  assert.match(popup, /account\/register/)
  assert.match(popup, /account\/login/)
  assert.match(layout, /<WelcomeGift \/>/)
  assert.match(checkout, /welcome-offer/)
  assert.match(checkout, /No account is required/)
})
