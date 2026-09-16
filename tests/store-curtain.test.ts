import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { testDatabase } from './d1-test-adapter.ts'
import {
  getPublicStoreCurtain,
  getStoreCurtain,
  saveStoreCurtain,
  validateStoreCurtain,
} from '../server/services/storeCurtain.ts'
import { storeCurtainHttpStatus, type StoreCurtainInput } from '../shared/storeCurtain.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const input = (overrides: Partial<StoreCurtainInput> = {}): StoreCurtainInput => ({
  enabled: true,
  mode: 'coming_soon',
  title: { en: 'COMING SOON.', ar: 'قريباً.' },
  message: { en: 'The next KHT chapter is almost here.', ar: 'الفصل الجديد من KHT قريب.' },
  imageUrl: null,
  countdownEnabled: false,
  launchAt: null,
  autoDisableAtLaunch: true,
  ctaEnabled: false,
  ctaLabel: { en: 'Follow KHT', ar: 'تابع KHT' },
  ctaUrl: '/',
  ...overrides,
})

test('store curtain persists as a disabled singleton and records the admin actor', async () => {
  const { database } = testDatabase()
  const initial = await getStoreCurtain(database)
  assert.equal(initial.enabled, false)
  assert.equal(initial.effectiveActive, false)

  const saved = await saveStoreCurtain(database, input(), 'admin@kht-eg.com')
  assert.equal(saved.enabled, true)
  assert.equal(saved.effectiveActive, true)
  assert.equal(saved.updatedBy, 'admin@kht-eg.com')
  assert.equal(saved.title.en, 'COMING SOON.')
})

test('public curtain omits audit data and automatically expires at launch', async () => {
  const { database } = testDatabase()
  await saveStoreCurtain(
    database,
    input({
      countdownEnabled: true,
      launchAt: '2099-09-15T12:00:00.000Z',
      autoDisableAtLaunch: true,
      imageUrl: '/api/media/11111111-1111-4111-8111-111111111111.webp',
    }),
    'admin@kht-eg.com',
  )

  const active = await getPublicStoreCurtain(database, new Date('2099-09-15T11:59:00.000Z'))
  assert.equal(active?.enabled, true)
  assert.equal(active?.imageUrl, '/api/media/11111111-1111-4111-8111-111111111111.webp')
  assert.equal('updatedBy' in (active || {}), false)
  assert.equal('updatedAt' in (active || {}), false)

  const expired = await getPublicStoreCurtain(database, new Date('2099-09-15T12:00:01.000Z'))
  assert.equal(expired, null)
  const automaticallyOpened = await getStoreCurtain(database, new Date('2099-09-15T12:00:01.000Z'))
  assert.equal(automaticallyOpened.enabled, false)
  assert.equal(automaticallyOpened.updatedBy, 'system:auto-launch')

  await saveStoreCurtain(
    database,
    input({
      countdownEnabled: true,
      launchAt: '2099-09-15T12:00:00.000Z',
      autoDisableAtLaunch: false,
    }),
    'admin@kht-eg.com',
  )
  assert.ok(await getPublicStoreCurtain(database, new Date('2099-09-15T12:00:01.000Z')))
})

test('store curtain validation rejects unsafe or incomplete configuration', () => {
  assert.throws(
    () => validateStoreCurtain(input({ title: { en: '', ar: 'قريباً' } })),
    /English title is required/,
  )
  assert.throws(
    () => validateStoreCurtain(input({ countdownEnabled: true, launchAt: null })),
    /Launch date and time is required/,
  )
  assert.throws(
    () => validateStoreCurtain(input({ imageUrl: 'https://example.com/tracker.png' })),
    /uploaded KHT media image/,
  )
  assert.throws(
    () => validateStoreCurtain(input({ ctaEnabled: true, ctaUrl: 'javascript:alert(1)' })),
    /safe store path or HTTPS URL/,
  )
})

test('coming-soon and custom launch pages remain shareable while maintenance stays temporary', () => {
  assert.equal(storeCurtainHttpStatus('coming_soon'), 200)
  assert.equal(storeCurtainHttpStatus('custom'), 200)
  assert.equal(storeCurtainHttpStatus('under_construction'), 503)
})

test('store curtain APIs use the existing authentication and public projection', () => {
  const adminGet = read('../server/api/admin/store-curtain.get.ts')
  const adminPut = read('../server/api/admin/store-curtain.put.ts')
  const publicGet = read('../server/api/storefront/store-curtain.get.ts')
  const references = read('../server/services/mediaReferences.ts')

  assert.match(adminGet, /requireAdmin\(event\)/)
  assert.match(adminPut, /requireAdmin\(event\)/)
  assert.match(adminPut, /saveStoreCurtain/)
  assert.match(publicGet, /getPublicStoreCurtain/)
  assert.doesNotMatch(publicGet, /requireAdmin/)
  assert.match(references, /store_curtain_settings/)
})

test('admin Settings provides every curtain control and reuses media uploads', () => {
  const page = read('../app/pages/admin/settings.vue')
  const sidebar = read('../app/components/admin/AdminSidebar.vue')
  const css = read('../app/assets/css/admin.css')

  assert.match(sidebar, /\{ label: 'Settings', to: '\/admin\/settings' \}/)
  assert.match(page, /Store availability/)
  assert.match(page, /Activate Store Curtain/)
  assert.match(page, /Coming Soon/)
  assert.match(page, /Under Construction/)
  assert.match(page, /English title/)
  assert.match(page, /Arabic title/)
  assert.match(page, /Enable countdown/)
  assert.match(page, /Open the store automatically/)
  assert.match(page, /\/api\/admin\/media/)
  assert.match(page, /Preview/)
  assert.match(css, /admin-store-curtain/)
})

test('storefront curtain blocks interaction, suppresses competing popup and uses temporary SEO', () => {
  const layout = read('../app/layouts/default.vue')
  const curtain = read('../app/components/StoreCurtain.vue')
  const css = read('../app/assets/css/main.css')

  assert.match(layout, /useFetch(?:<[^>]+>)?\(\s*'\/api\/storefront\/store-curtain'/)
  assert.match(layout, /:inert="curtainActive/)
  assert.match(layout, /:aria-hidden="curtainActive/)
  assert.match(layout, /<WelcomeGift v-if="!curtainActive"/)
  assert.match(layout, /setResponseStatus\([^,]+, 503\)/)
  assert.match(layout, /storeCurtainHttpStatus/)
  assert.match(layout, /import \{ setResponseHeader \} from 'h3'/)
  assert.match(layout, /noindex, nofollow/)
  assert.match(curtain, /preview \? 'region' : 'dialog'/)
  assert.match(curtain, /preview \? undefined : 'true'/)
  assert.match(curtain, /days/)
  assert.doesNotMatch(curtain, /Close curtain|closeCurtain/)
  assert.match(css, /backdrop-filter:\s*blur\((?:2[4-9]|[3-9][0-9])px\)/)
  assert.match(css, /font-family:\s*Impact/)
  assert.match(css, /filter:\s*grayscale\(1\)/)
})
