import {
  DEFAULT_STORE_CONTENT,
  DEFAULT_HOME_SHOPPING,
  cloneStoreContent,
  type AdminStoreContentState,
  type ContentText,
  type PublicStoreContent,
  type StoreContentVersion,
  type StorefrontContent,
} from '../../shared/storeContent.ts'
import type { D1Database } from '../utils/d1'

type ContentStateRow = {
  draftJson: string
  publishedJson: string
  draftUpdatedAt: string
  draftUpdatedBy: string
  publishedAt: string
  publishedBy: string
}

type VersionRow = StoreContentVersion & { contentJson?: string }

const stateQuery = `SELECT draft_json AS draftJson, published_json AS publishedJson,
  draft_updated_at AS draftUpdatedAt, draft_updated_by AS draftUpdatedBy,
  published_at AS publishedAt, published_by AS publishedBy
  FROM storefront_content_state WHERE id = 1`

const pageKeys = [
  'home',
  'shop',
  'drop',
  'category',
  'about',
  'sizeGuide',
  'trackOrder',
  'shipping',
  'contact',
  'faq',
  'privacy',
  'terms',
] as const

function requiredText(value: unknown, label: string, maximum: number, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()))
    throw new Error(`${label} is required.`)
  if (value.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`)
  return value
}

function bilingual(
  value: ContentText | undefined,
  label: string,
  maximum: number,
  allowEmpty = false,
) {
  requiredText(value?.en, `English ${label}`, maximum, allowEmpty)
  requiredText(value?.ar, `Arabic ${label}`, maximum, allowEmpty)
}

function safeLink(value: unknown, label: string, allowEmpty = false) {
  const url = requiredText(value, label, 500, allowEmpty).trim()
  if (!url && allowEmpty) return
  if (url.startsWith('/') && !url.startsWith('//') && !/[\\\r\n]/.test(url)) return
  try {
    if (new URL(url).protocol === 'https:') return
  } catch {
    // Use the clearer common validation message below.
  }
  throw new Error(`${label} must be a safe store path or HTTPS URL.`)
}

function safeImage(value: unknown, label: string, allowEmpty = true) {
  if (value === null || value === undefined || value === '') {
    if (allowEmpty) return
    throw new Error(`${label} is required.`)
  }
  if (typeof value !== 'string') throw new Error(`${label} must be a KHT image.`)
  if (/^\/images\/[a-zA-Z0-9._/-]+$/.test(value)) return
  if (/^\/api\/media\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(value)) return
  throw new Error(`${label} must be a KHT image.`)
}

export function validateStoreContent(input: StorefrontContent) {
  if (!input || typeof input !== 'object') throw new Error('Store content is required.')
  const brand = input.brand
  if (!brand || typeof brand !== 'object') throw new Error('Brand content is required.')
  requiredText(brand.name, 'Brand name', 80)
  for (const [label, value, max] of [
    ['tagline', brand.tagline, 120],
    ['subline', brand.subline, 180],
    ['announcement start', brand.announcementStart, 120],
    ['announcement center', brand.announcementCenter, 120],
    ['announcement end', brand.announcementEnd, 120],
    ['footer collection title', brand.footerCollectionTitle, 80],
    ['footer care title', brand.footerCareTitle, 80],
    ['footer statement', brand.footerStatement, 180],
    ['footer statement link label', brand.footerStatementLinkLabel, 80],
    ['footer payment line', brand.footerPaymentLine, 140],
    ['privacy label', brand.privacyLabel, 60],
    ['terms label', brand.termsLabel, 60],
  ] as const)
    bilingual(value, label, max)
  if (
    !Number.isInteger(brand.announcementDurationSeconds) ||
    brand.announcementDurationSeconds < 10 ||
    brand.announcementDurationSeconds > 60
  )
    throw new Error('Announcement speed must be between 10 and 60 seconds.')
  safeImage(brand.logoUrl, 'Brand logo')
  safeImage(brand.defaultSocialImageUrl, 'Default social sharing image', false)
  safeLink(brand.footerStatementLinkUrl, 'Footer statement destination')
  if (brand.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brand.contactEmail))
    throw new Error('Contact email must be valid.')
  requiredText(brand.contactEmail, 'Contact email', 254, true)
  requiredText(brand.contactPhone, 'Contact phone', 40, true)
  requiredText(brand.contactWhatsApp, 'WhatsApp number', 40, true)
  for (const [label, value] of [
    ['Instagram URL', brand.instagramUrl],
    ['Facebook URL', brand.facebookUrl],
    ['TikTok URL', brand.tiktokUrl],
  ] as const)
    safeLink(value, label, true)

  if (!Array.isArray(input.navigation) || input.navigation.length > 30)
    throw new Error('Navigation must contain no more than 30 links.')
  const ids = new Set<string>()
  for (const item of input.navigation) {
    if (!/^[a-z0-9-]{1,60}$/.test(item.id) || ids.has(item.id))
      throw new Error('Every link needs a unique navigation ID.')
    ids.add(item.id)
    bilingual(item.label, 'navigation label', 80)
    safeLink(item.href, 'Navigation destination')
    if (!['main', 'bottom'].includes(item.mobileSection))
      throw new Error('Choose a valid mobile navigation section.')
    if (!['none', 'collection', 'care'].includes(item.footerColumn))
      throw new Error('Choose a valid footer navigation column.')
  }

  if (!input.pages || typeof input.pages !== 'object') throw new Error('Page content is required.')
  for (const key of pageKeys) {
    const page = input.pages[key]
    if (!page) throw new Error(`${key} page content is required.`)
    const hero = page.hero
    bilingual(hero.eyebrow, `${page.label} eyebrow`, 160)
    bilingual(hero.title, `${page.label} title`, 180)
    bilingual(hero.body, `${page.label} introduction`, 800)
    bilingual(hero.imageAlt, `${page.label} image description`, 240)
    safeImage(hero.imageUrl, `${page.label} desktop hero image`)
    safeImage(hero.mobileImageUrl, `${page.label} mobile hero image`)
    safeLink(hero.ctaUrl, `${page.label} hero button destination`)
    if (hero.ctaEnabled) bilingual(hero.ctaLabel, `${page.label} hero button label`, 80)

    bilingual(page.seo.title, `${page.label} SEO title`, 120)
    bilingual(page.seo.description, `${page.label} SEO description`, 320)
    safeImage(page.seo.socialImageUrl, `${page.label} social sharing image`)
    if (!Array.isArray(page.sections) || page.sections.length > 20)
      throw new Error(`${page.label} must contain no more than 20 sections.`)
    const sectionIds = new Set<string>()
    for (const section of page.sections) {
      if (!/^[a-z0-9-]{1,60}$/.test(section.id) || sectionIds.has(section.id))
        throw new Error(`Every ${page.label} section needs a unique ID.`)
      sectionIds.add(section.id)
      bilingual(section.eyebrow, `${page.label} section eyebrow`, 160, true)
      bilingual(section.heading, `${page.label} section heading`, 220)
      bilingual(section.body, `${page.label} section body`, 5000, true)
      bilingual(section.ctaLabel, `${page.label} section button label`, 80, true)
      safeLink(section.ctaUrl, `${page.label} section button destination`)
    }
  }
  const shopping = input.pages.home.homeShopping
  if (shopping) {
    bilingual(shopping.heroCaption, 'homepage hero image caption', 120, true)
    bilingual(shopping.heroScrollLabel, 'homepage hero scroll label', 80, true)
    requiredText(shopping.heroProductSlug, 'Homepage hero product slug', 120)
    if (!/^[a-z0-9-]+$/.test(shopping.heroProductSlug))
      throw new Error('Homepage hero product slug is invalid.')
    if (
      typeof shopping.heroUseProductLink !== 'boolean' ||
      typeof shopping.heroShowPrice !== 'boolean'
    )
      throw new Error('Homepage hero product options are invalid.')
    bilingual(shopping.heroPricePrefix, 'homepage hero price prefix', 80)
    if (typeof shopping.secondaryEnabled !== 'boolean')
      throw new Error('Homepage secondary button option is invalid.')
    bilingual(shopping.secondaryLabel, 'homepage secondary button', 80)
    safeLink(shopping.secondaryUrl, 'Homepage secondary button destination')
    if (
      [
        shopping.stripEnabled,
        shopping.sectionEnabled,
        shopping.sectionShowAllLink,
        shopping.sectionShowFooter,
      ].some((value) => typeof value !== 'boolean')
    )
      throw new Error('Homepage section visibility options are invalid.')
    bilingual(shopping.stripStart, 'homepage strip start', 120)
    bilingual(shopping.stripCenter, 'homepage strip center', 120)
    bilingual(shopping.stripEnd, 'homepage strip end', 120)
    if (!Array.isArray(shopping.cards) || shopping.cards.length > 6)
      throw new Error('Homepage shopping cards must contain no more than 6 items.')
    const cardIds = new Set<string>()
    for (const card of shopping.cards) {
      if (!/^[a-z0-9-]{1,60}$/.test(card.id) || cardIds.has(card.id))
        throw new Error('Every homepage shopping card needs a unique ID.')
      cardIds.add(card.id)
      if (!/^[a-z0-9-]{1,120}$/.test(card.productSlug))
        throw new Error('Homepage shopping card product slug is invalid.')
      for (const [label, value, max] of [
        ['eyebrow', card.eyebrow, 160],
        ['heading', card.heading, 220],
        ['body', card.body, 500],
        ['image description', card.imageAlt, 240],
        ['button label', card.ctaLabel, 80],
      ] as const)
        bilingual(value, `homepage shopping card ${label}`, max)
      safeImage(card.imageUrl, 'Homepage shopping card image')
      safeImage(card.mobileImageUrl, 'Homepage shopping card mobile image')
      safeLink(card.ctaUrl, 'Homepage shopping card button destination')
      if (
        typeof card.enabled !== 'boolean' ||
        typeof card.useProductLink !== 'boolean' ||
        typeof card.showPrice !== 'boolean'
      )
        throw new Error('Homepage shopping card options are invalid.')
    }
  }
  return input
}

function parseContent(value: string) {
  if (!value || value === '{}') return cloneStoreContent()
  try {
    const content = JSON.parse(value) as StorefrontContent
    // Preserve existing announcement copy when older saved content gains motion controls.
    if (content.brand && content.brand.announcementDurationSeconds === undefined)
      content.brand.announcementDurationSeconds =
        DEFAULT_STORE_CONTENT.brand.announcementDurationSeconds
    // Older published content predates the shoppable homepage. Preserve every existing edit.
    if (content.pages?.home && !('homeShopping' in content.pages.home)) {
      content.pages.home.homeShopping = structuredClone(DEFAULT_HOME_SHOPPING)
      const heroButton = content.pages.home.hero.ctaLabel
      if (heroButton?.en === 'SHOP DROP 001' && heroButton.ar === 'تسوق الإصدار 001')
        content.pages.home.hero.ctaLabel = { en: 'SHOP THE FULL SET', ar: 'تسوق الطقم الكامل' }
      const collection = content.pages.home.sections.find((section) => section.id === 'collection')
      if (
        collection?.heading.en === 'THE ESSENTIALS.' &&
        collection.heading.ar === 'القطع الأساسية.'
      )
        collection.heading = { en: 'SHOP THE LOOK.', ar: 'الإطلالة كاملة أو قطعتك.' }
      if (
        collection?.body.en === 'Three silhouettes. One identity.' &&
        collection.body.ar === 'ثلاث قصّات. هوية واحدة.'
      )
        collection.body = {
          en: 'The full set or your favourite piece. Choose your way.',
          ar: 'الطقم الكامل أو القطعة اللي تناسبك. اختار بطريقتك.',
        }
    }
    return validateStoreContent(content)
  } catch {
    return cloneStoreContent(DEFAULT_STORE_CONTENT)
  }
}

async function stateRow(database: D1Database) {
  const row = await database.prepare(stateQuery).first<ContentStateRow>()
  if (!row) throw new Error('Store content settings are unavailable.')
  return row
}

export async function getAdminStoreContent(database: D1Database): Promise<AdminStoreContentState> {
  const row = await stateRow(database)
  const versionsResult = await database
    .prepare(
      `SELECT id, published_at AS publishedAt, published_by AS publishedBy
     FROM storefront_content_versions ORDER BY published_at DESC, id DESC LIMIT 30`,
    )
    .all<StoreContentVersion>()
  const draft = parseContent(row.draftJson)
  const published = parseContent(row.publishedJson)
  return {
    draft,
    published,
    draftUpdatedAt: row.draftUpdatedAt,
    draftUpdatedBy: row.draftUpdatedBy,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
    hasUnpublishedChanges: JSON.stringify(draft) !== JSON.stringify(published),
    versions: versionsResult.results || [],
  }
}

export async function saveStoreContentDraft(
  database: D1Database,
  input: StorefrontContent,
  actor: string,
) {
  validateStoreContent(input)
  const updatedAt = new Date().toISOString()
  await database
    .prepare(
      `UPDATE storefront_content_state SET draft_json=?, draft_updated_at=?, draft_updated_by=? WHERE id=1`,
    )
    .bind(JSON.stringify(input), updatedAt, actor)
    .run()
  return getAdminStoreContent(database)
}

export async function publishStoreContent(
  database: D1Database,
  input: StorefrontContent,
  actor: string,
) {
  validateStoreContent(input)
  const publishedAt = new Date().toISOString()
  const id = crypto.randomUUID()
  const content = JSON.stringify(input)
  await database.batch([
    database
      .prepare(
        `UPDATE storefront_content_state SET draft_json=?, published_json=?, draft_updated_at=?,
       draft_updated_by=?, published_at=?, published_by=? WHERE id=1`,
      )
      .bind(content, content, publishedAt, actor, publishedAt, actor),
    database
      .prepare(
        `INSERT INTO storefront_content_versions (id, content_json, published_at, published_by)
       VALUES (?, ?, ?, ?)`,
      )
      .bind(id, content, publishedAt, actor),
  ])
  return getAdminStoreContent(database)
}

export async function restoreStoreContentVersion(
  database: D1Database,
  versionId: string,
  actor: string,
) {
  const row = await database
    .prepare(`SELECT content_json AS contentJson FROM storefront_content_versions WHERE id=?`)
    .bind(versionId)
    .first<VersionRow>()
  if (!row?.contentJson) throw new Error('Published version was not found.')
  const content = parseContent(row.contentJson)
  return saveStoreContentDraft(database, content, actor)
}

export async function getPublicStoreContent(database: D1Database): Promise<PublicStoreContent> {
  const row = await stateRow(database)
  return { content: parseContent(row.publishedJson), revision: row.publishedAt }
}
