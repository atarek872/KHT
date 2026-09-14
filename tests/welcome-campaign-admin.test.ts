import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { WelcomeCampaignInput } from '../shared/welcomeCampaign.ts'
import { getWelcomeCampaign, saveWelcomeCampaign } from '../server/services/welcomeCampaign.ts'
import { resolveCustomerDiscountCode } from '../server/services/welcomeOffer.ts'
import { testDatabase } from './d1-test-adapter.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const campaignInput = (overrides: Partial<WelcomeCampaignInput> = {}): WelcomeCampaignInput => ({
  enabled: true,
  discountId: 'customer-welcome-5',
  desktopDelaySeconds: 30,
  mobileDelaySeconds: 60,
  dismissalDays: 30,
  displayMode: 'home',
  displayPath: '/',
  eyebrow: { en: 'KHT / WELCOME GIFT', ar: 'KHT / هدية ترحيب' },
  title: { en: 'YOUR FIRST ORDER. 5% OFF.', ar: 'خصم ٥٪ على أول طلب.' },
  body: {
    en: 'Create your account or sign in. Your gift is applied automatically.',
    ar: 'أنشئ حسابك أو سجل الدخول، وسيتم تطبيق هديتك تلقائياً.',
  },
  primaryLabel: { en: 'Claim my gift', ar: 'احصل على هديتي' },
  primaryRedirect: '/account/register?returnTo={current}',
  secondaryLabel: { en: 'Already have an account? Sign in', ar: 'عندك حساب؟ سجل دخولك' },
  secondaryRedirect: '/account/login?returnTo={current}',
  ...overrides,
})

test('welcome campaign settings persist through one validated service', async () => {
  const { database, sql } = testDatabase()
  try {
    const saved = await saveWelcomeCampaign(
      database,
      campaignInput({
        desktopDelaySeconds: 20,
        displayMode: 'path',
        displayPath: '/drops/001',
        title: { en: 'JOIN THE LINE.', ar: 'انضم للخط.' },
      }),
      'admin@example.com',
    )
    assert.equal(saved.desktopDelaySeconds, 20)
    assert.equal(saved.displayMode, 'path')
    assert.equal(saved.displayPath, '/drops/001')
    assert.equal(saved.title.en, 'JOIN THE LINE.')
    assert.equal(saved.discount?.code, 'WELCOME5')
    assert.deepEqual((await getWelcomeCampaign(database)).title, saved.title)

    await assert.rejects(
      saveWelcomeCampaign(
        database,
        campaignInput({ primaryRedirect: 'https://example.com' }),
        'admin@example.com',
      ),
      /store-relative path/i,
    )
    await assert.rejects(
      saveWelcomeCampaign(
        database,
        campaignInput({ displayMode: 'path', displayPath: 'https://example.com' }),
        'admin@example.com',
      ),
      /store-relative path/i,
    )
  } finally {
    sql.close()
  }
})

test('a campaign coupon can be used once per signed-in customer even after an earlier order', async () => {
  const { database, sql } = testDatabase()
  try {
    sql
      .prepare(
        `INSERT INTO discounts
         (id,code,type,value,active,login_required,once_per_customer,first_order_only)
         VALUES('campaign-code','KHTFAMILY','percentage',8,1,1,1,0)`,
      )
      .run()
    await saveWelcomeCampaign(
      database,
      campaignInput({
        discountId: 'campaign-code',
        title: { en: '8% FOR THE LINE.', ar: 'خصم ٨٪ لعائلة KHT.' },
      }),
      'admin@example.com',
    )
    sql
      .prepare(
        `INSERT INTO customer_users(id,name,email,phone,password_hash)
       VALUES('user-a','Customer A','a@example.com','01000000001','hash')`,
      )
      .run()
    sql
      .prepare(
        `INSERT INTO customers(id,name,phone,phone_normalized,email,address,governorate,city)
       VALUES('customer-a','Customer A','01000000001','201000000001','a@example.com','Street','Cairo','Cairo')`,
      )
      .run()
    sql
      .prepare(
        `INSERT INTO orders
       (id,number,public_reference,idempotency_key,customer_id,subtotal,shipping,
        shipping_governorate,discount,total,payment_method,source,user_id,created_at)
       VALUES('older-order','KHT-OLDER','KHT-OLDER-PUBLIC','older-request','customer-a',1000,60,
        'Cairo',0,1060,'cod','website','user-a','2026-09-01T00:00:00.000Z')`,
      )
      .run()

    assert.equal(
      await resolveCustomerDiscountCode(database, {
        userId: 'user-a',
        requestedCode: 'KHTFAMILY',
      }),
      'KHTFAMILY',
    )
    assert.equal(
      await resolveCustomerDiscountCode(database, {
        userId: null,
        requestedCode: 'KHTFAMILY',
      }).then(
        () => 'allowed',
        (error: Error) => error.message,
      ),
      'This coupon is available to signed-in customers only.',
    )

    sql
      .prepare(
        `INSERT INTO orders
       (id,number,public_reference,idempotency_key,customer_id,subtotal,shipping,
        shipping_governorate,discount,total,payment_method,source,user_id,discount_id,
        discount_code,created_at)
       VALUES('discounted-order','KHT-DISCOUNT','KHT-DISCOUNT-PUBLIC','discount-request',
        'customer-a',1000,60,'Cairo',80,980,'cod','website','user-a','campaign-code',
        'KHTFAMILY','2026-09-14T00:00:00.000Z')`,
      )
      .run()
    assert.equal(
      Number(
        (
          sql
            .prepare(
              `SELECT COUNT(*) AS count FROM customer_discount_redemptions
               WHERE user_id='user-a' AND discount_id='campaign-code'`,
            )
            .get() as { count: number }
        ).count,
      ),
      1,
    )
    await assert.rejects(
      resolveCustomerDiscountCode(database, {
        userId: 'user-a',
        requestedCode: 'KHTFAMILY',
      }),
      /already been used/i,
    )
  } finally {
    sql.close()
  }
})

test('admin and storefront routes expose only their intended campaign controls', () => {
  const adminPage = read('../app/pages/admin/welcome-campaign.vue')
  const discountsPage = read('../app/pages/admin/discounts/index.vue')
  const campaignPanel = read('../app/components/admin/discounts/WelcomeCampaignPanel.vue')
  const sidebar = read('../app/components/admin/AdminSidebar.vue')
  const popup = read('../app/components/WelcomeGift.vue')
  const adminGet = read('../server/api/admin/welcome-campaign.get.ts')
  const adminPut = read('../server/api/admin/welcome-campaign.put.ts')
  const publicGet = read('../server/api/storefront/welcome-campaign.get.ts')

  for (const route of [adminGet, adminPut]) assert.match(route, /requireAdmin\(event\)/)
  assert.doesNotMatch(publicGet, /requireAdmin|updatedBy/)
  assert.doesNotMatch(sidebar, /Welcome Campaign/)
  assert.match(discountsPage, /Coupon codes/)
  assert.match(discountsPage, /Welcome popup/)
  assert.match(discountsPage, /AdminDiscountsWelcomeCampaignPanel/)
  assert.match(adminPage, /\/admin\/discounts\?view=welcome/)
  for (const field of [
    'Desktop delay',
    'Mobile delay',
    'Dismiss for',
    'Show on',
    'Specific page',
    'Page path',
    'Coupon',
    'English title',
    'Arabic title',
    'Primary destination',
    'Coupon eligibility',
    'Edit coupon eligibility',
  ])
    assert.match(campaignPanel, new RegExp(field))
  const discountForm = read('../app/components/admin/discounts/DiscountForm.vue')
  assert.match(discountForm, /Signed-in customers only/)
  assert.match(discountForm, /Once per customer/)
  assert.match(discountForm, /First order only/)
  assert.match(popup, /\/api\/storefront\/welcome-campaign/)
  assert.match(popup, /campaign\.value\.displayMode/)
  assert.match(popup, /campaign\.value\.displayPath/)
  assert.doesNotMatch(popup, /const dismissalWindow = 30|60_000|30_000/)
})
