import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { testDatabase } from './d1-test-adapter.ts'
import { DEFAULT_STORE_CONTENT, cloneStoreContent } from '../shared/storeContent.ts'
import {
  getAdminStoreContent,
  getPublicStoreContent,
  publishStoreContent,
  restoreStoreContentVersion,
  saveStoreContentDraft,
  validateStoreContent,
} from '../server/services/storeContent.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('compiled storefront content is the initial draft and published fallback', async () => {
  const { database } = testDatabase()
  const state = await getAdminStoreContent(database)
  assert.deepEqual(state.draft, DEFAULT_STORE_CONTENT)
  assert.deepEqual(state.published, DEFAULT_STORE_CONTENT)
  assert.equal(state.hasUnpublishedChanges, false)
  assert.deepEqual(state.versions, [])
})

test('draft stays private until publish and each publish creates a restorable version', async () => {
  const { database } = testDatabase()
  const first = cloneStoreContent(DEFAULT_STORE_CONTENT)
  first.pages.home.hero.title.en = 'A NEW LINE.'
  first.brand.announcementStart.en = 'NEW DROP ✨'
  first.brand.announcementDurationSeconds = 18
  await saveStoreContentDraft(database, first, 'admin@kht-eg.com')
  assert.equal(
    (await getPublicStoreContent(database)).content.pages.home.hero.title.en,
    'BLACK.\nWHITE.\nLINE.',
  )

  const publishedFirst = await publishStoreContent(database, first, 'admin@kht-eg.com')
  assert.equal(publishedFirst.published.pages.home.hero.title.en, 'A NEW LINE.')
  assert.equal(
    (await getPublicStoreContent(database)).content.brand.announcementStart.en,
    'NEW DROP ✨',
  )
  assert.equal(
    (await getPublicStoreContent(database)).content.brand.announcementDurationSeconds,
    18,
  )
  assert.equal(publishedFirst.versions.length, 1)

  const second = cloneStoreContent(first)
  second.pages.home.hero.title.en = 'CHAPTER TWO.'
  const publishedSecond = await publishStoreContent(database, second, 'admin@kht-eg.com')
  assert.equal(publishedSecond.versions.length, 2)
  assert.equal(
    (await getPublicStoreContent(database)).content.pages.home.hero.title.en,
    'CHAPTER TWO.',
  )

  const restored = await restoreStoreContentVersion(
    database,
    publishedSecond.versions[1]!.id,
    'admin@kht-eg.com',
  )
  assert.equal(restored.draft.pages.home.hero.title.en, 'A NEW LINE.')
  assert.equal(restored.published.pages.home.hero.title.en, 'CHAPTER TWO.')
  assert.equal(restored.hasUnpublishedChanges, true)
})

test('content validation rejects unsafe links, images, duplicate navigation, and empty bilingual copy', () => {
  const badLink = cloneStoreContent(DEFAULT_STORE_CONTENT)
  badLink.navigation[0]!.href = 'javascript:alert(1)'
  assert.throws(() => validateStoreContent(badLink), /safe store path or HTTPS URL/)

  const badImage = cloneStoreContent(DEFAULT_STORE_CONTENT)
  badImage.pages.home.hero.imageUrl = 'https://tracker.example/pixel.png'
  assert.throws(() => validateStoreContent(badImage), /KHT image/)

  const duplicate = cloneStoreContent(DEFAULT_STORE_CONTENT)
  duplicate.navigation.push({ ...duplicate.navigation[0]! })
  assert.throws(() => validateStoreContent(duplicate), /unique navigation ID/)

  const emptyArabic = cloneStoreContent(DEFAULT_STORE_CONTENT)
  emptyArabic.pages.about.hero.title.ar = ''
  assert.throws(() => validateStoreContent(emptyArabic), /Arabic/)

  const unsafeCard = cloneStoreContent(DEFAULT_STORE_CONTENT)
  unsafeCard.pages.home.homeShopping!.cards[0]!.imageUrl = 'https://tracker.example/pixel.png'
  assert.throws(() => validateStoreContent(unsafeCard), /KHT image/)

  const unsafeSecondButton = cloneStoreContent(DEFAULT_STORE_CONTENT)
  unsafeSecondButton.pages.home.homeShopping!.secondaryUrl = 'javascript:alert(1)'
  assert.throws(() => validateStoreContent(unsafeSecondButton), /safe store path or HTTPS URL/)

  const duplicateCard = cloneStoreContent(DEFAULT_STORE_CONTENT)
  duplicateCard.pages.home.homeShopping!.cards.push({
    ...duplicateCard.pages.home.homeShopping!.cards[0]!,
  })
  assert.throws(() => validateStoreContent(duplicateCard), /unique ID/)

  const invalidAnnouncementSpeed = cloneStoreContent(DEFAULT_STORE_CONTENT)
  invalidAnnouncementSpeed.brand.announcementDurationSeconds = 5
  assert.throws(() => validateStoreContent(invalidAnnouncementSpeed), /announcement speed/i)
  invalidAnnouncementSpeed.brand.announcementDurationSeconds = 20.5
  assert.throws(() => validateStoreContent(invalidAnnouncementSpeed), /announcement speed/i)

  const emojiAnnouncement = cloneStoreContent(DEFAULT_STORE_CONTENT)
  emojiAnnouncement.brand.announcementStart.en = 'A new drop ✨'
  emojiAnnouncement.brand.announcementStart.ar = 'إصدار جديد ✨'
  assert.doesNotThrow(() => validateStoreContent(emojiAnnouncement))
})

test('old published content gains shopping controls without losing customized copy', async () => {
  const { database } = testDatabase()
  const legacy = cloneStoreContent(DEFAULT_STORE_CONTENT)
  legacy.pages.home.hero.title.en = 'CUSTOM CAMPAIGN'
  legacy.pages.home.hero.ctaLabel = { en: 'SHOP DROP 001', ar: 'تسوق الإصدار 001' }
  const collection = legacy.pages.home.sections.find((section) => section.id === 'collection')!
  collection.heading = { en: 'THE ESSENTIALS.', ar: 'القطع الأساسية.' }
  collection.ctaUrl = '/drops/001'
  delete legacy.pages.home.homeShopping
  await database
    .prepare('UPDATE storefront_content_state SET published_json=?, draft_json=? WHERE id=1')
    .bind(JSON.stringify(legacy), JSON.stringify(legacy))
    .run()
  const state = await getAdminStoreContent(database)
  assert.equal(state.published.pages.home.hero.title.en, 'CUSTOM CAMPAIGN')
  assert.equal(state.published.pages.home.hero.ctaLabel.en, 'SHOP THE FULL SET')
  assert.equal(state.published.pages.home.sections[0]?.ctaUrl, '/drops/001')
  assert.equal(state.published.pages.home.sections[0]?.heading.en, 'SHOP THE LOOK.')
  assert.equal(state.published.pages.home.homeShopping?.cards.length, 3)
  assert.equal(state.hasUnpublishedChanges, false)
})

test('existing published announcements gain the default motion speed without losing copy', async () => {
  const { database } = testDatabase()
  const legacy = cloneStoreContent(DEFAULT_STORE_CONTENT)
  legacy.brand.announcementStart.en = 'CUSTOM DROP ✨'
  delete (legacy.brand as Partial<typeof legacy.brand>).announcementDurationSeconds
  await database
    .prepare('UPDATE storefront_content_state SET published_json=?, draft_json=? WHERE id=1')
    .bind(JSON.stringify(legacy), JSON.stringify(legacy))
    .run()
  const state = await getAdminStoreContent(database)
  assert.equal(state.published.brand.announcementStart.en, 'CUSTOM DROP ✨')
  assert.equal(state.published.brand.announcementDurationSeconds, 24)
  assert.equal(state.hasUnpublishedChanges, false)
})

test('content APIs protect mutations and expose one public published projection', () => {
  for (const path of [
    '../server/api/admin/store-content.get.ts',
    '../server/api/admin/store-content/draft.put.ts',
    '../server/api/admin/store-content/publish.post.ts',
    '../server/api/admin/store-content/restore.post.ts',
  ])
    assert.match(read(path), /requireAdmin\(event\)/, path)

  const publicRoute = read('../server/api/storefront/content.get.ts')
  assert.match(publicRoute, /getPublicStoreContent/)
  assert.doesNotMatch(publicRoute, /requireAdmin|updatedBy|versions/)
  const references = read('../server/services/mediaReferences.ts')
  assert.match(references, /storefront_content_state/)
  assert.match(references, /storefront_content_versions/)
})

test('Settings exposes focused content management tabs and complete controls', () => {
  const settings = read('../app/pages/admin/settings.vue')
  const editor = read('../app/components/admin/settings/StoreContentEditor.vue')
  for (const label of ['Availability', 'Brand', 'Navigation', 'Pages & SEO', 'Publishing'])
    assert.match(settings, new RegExp(label.replace('&', '&amp;|&')))
  assert.match(editor, /Save draft/)
  assert.match(editor, /Publish changes/)
  assert.match(editor, /Restore to draft/)
  assert.match(editor, /Desktop hero image/)
  assert.match(editor, /Mobile hero image/)
  assert.match(editor, /Social sharing image/)
  assert.match(editor, /English image description/)
  assert.match(editor, /Move up/)
  assert.match(editor, /Add navigation link/)
  assert.match(editor, /\/api\/admin\/media/)
})

test('Drop 001 feature banner has dedicated editable image and bilingual copy controls', () => {
  const editor = read('../app/components/admin/settings/StoreContentEditor.vue')
  const collection = read('../app/components/CollectionView.vue')
  const featureBanner = DEFAULT_STORE_CONTENT.pages.drop.sections.find(
    (section) => section.id === 'feature-banner',
  )

  assert.equal(featureBanner?.heading.en, 'THE FIRST CHAPTER.')
  assert.equal(featureBanner?.heading.ar, 'الفصل الأول.')
  assert.match(editor, /Drop 001 feature banner/)
  assert.match(editor, /Desktop banner image/)
  assert.match(editor, /Mobile banner image/)
  assert.match(editor, /English banner text/)
  assert.match(editor, /Arabic banner text/)
  assert.match(collection, /dropBanner/)
  assert.match(collection, /page\.hero\.mobileImageUrl/)
})

test('published content loads before storefront rendering and drives global and page content', () => {
  const plugin = read('../app/plugins/store-content.ts')
  const header = read('../app/components/SiteHeader.vue')
  const footer = read('../app/components/SiteFooter.vue')
  const home = read('../app/pages/index.vue')
  const collection = read('../app/components/CollectionView.vue')
  const info = read('../app/pages/[info].vue')

  assert.match(plugin, /\/api\/storefront\/content/)
  assert.match(plugin, /useStoreContent/)
  for (const source of [header, footer, home, collection, info])
    assert.match(source, /useStoreContent/)
  assert.match(header, /navigation/)
  assert.match(footer, /footerColumn/)
  assert.match(home, /pages\.home/)
  assert.match(collection, /pages\[pageKey/)
  assert.match(info, /page\.sections/)
})
