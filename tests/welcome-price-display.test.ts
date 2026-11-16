import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { createTestD1 } from './helpers/sqliteD1.ts'
import { getDiscountPercentage } from '../shared/productPricing.ts'
import { firstOrderWelcomePrice } from '../shared/welcomePrice.ts'
import { getPublicWelcomeCampaign } from '../server/services/welcomeCampaign.ts'

function campaign(discount: Record<string, unknown> = {}) {
  return {
    loginRequired: true,
    firstOrderOnly: true,
    oncePerCustomer: true,
    discount: {
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      minimumOrder: null,
      maximumDiscount: null,
      ...discount,
    },
  }
}

test('WELCOME10 shows the exact first-order product price without changing the selling price', () => {
  assert.equal(firstOrderWelcomePrice(2050, campaign()), 1845)
  assert.equal(firstOrderWelcomePrice(1200, campaign()), 1080)
  assert.equal(firstOrderWelcomePrice(920, campaign()), 828)
  assert.equal(firstOrderWelcomePrice(2050, campaign({ value: 5 })), null)
  assert.equal(firstOrderWelcomePrice(2050, campaign({ minimumOrder: 3000 })), null)
  assert.equal(firstOrderWelcomePrice(2050, campaign({ maximumDiscount: 100 })), null)
  assert.equal(firstOrderWelcomePrice(2050, campaign({ code: 'OTHER10' })), null)
  assert.equal(firstOrderWelcomePrice(2050, null), null)
})

test('20% merchandising migration preserves the three actual sale prices', async () => {
  const { database, sqlite, close } = createTestD1()
  try {
    const directory = new URL('../server/db/migrations/', import.meta.url)
    for (const name of readdirSync(directory)
      .filter((item) => item.endsWith('.sql') && item < '0022_sale_price_display.sql')
      .sort()) {
      sqlite.exec(readFileSync(new URL(name, directory), 'utf8'))
    }
    sqlite.exec(`UPDATE products SET slug='line-01-full-set-black', price=2050, compare_at_price=NULL WHERE id='kht-001';
      UPDATE products SET slug='line-01-oversized-hoodie-black', price=1200, compare_at_price=1500 WHERE id='kht-002';
      UPDATE products SET slug='line-01-wide-leg-pants-black', price=920, compare_at_price=1160 WHERE id='kht-003';`)
    sqlite.exec(readFileSync(new URL('0022_sale_price_display.sql', directory), 'utf8'))
    const rows = sqlite
      .prepare(
        `SELECT slug, price, compare_at_price AS compareAtPrice FROM products WHERE id IN ('kht-001','kht-002','kht-003') ORDER BY slug`,
      )
      .all() as Array<{ slug: string; price: number; compareAtPrice: number }>
    assert.deepEqual(
      rows.map(({ slug, price, compareAtPrice }) => [
        slug,
        price,
        compareAtPrice,
        getDiscountPercentage(price, compareAtPrice),
      ]),
      [
        ['line-01-full-set-black', 2050, 2563, 20],
        ['line-01-oversized-hoodie-black', 1200, 1500, 20],
        ['line-01-wide-leg-pants-black', 920, 1150, 20],
      ],
    )
    sqlite.exec(`UPDATE discounts SET code='WELCOME10', value=10 WHERE id='customer-welcome-5'`)
    assert.equal(firstOrderWelcomePrice(2050, await getPublicWelcomeCampaign(database)), 1845)
    sqlite.exec(
      `UPDATE discounts SET valid_until='2000-01-01T00:00:00.000Z' WHERE id='customer-welcome-5'`,
    )
    assert.equal(await getPublicWelcomeCampaign(database), null)
  } finally {
    close()
  }
})
