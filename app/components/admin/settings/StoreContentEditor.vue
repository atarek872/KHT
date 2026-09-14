<script setup lang="ts">
import {
  cloneStoreContent,
  DEFAULT_STORE_CONTENT,
  type AdminStoreContentState,
  type StoreNavigationItem,
  type StorePageKey,
  type StorefrontContent,
} from '#shared/storeContent'

const props = defineProps<{ view: 'brand' | 'navigation' | 'pages' | 'publishing' }>()
const { data, error, status, refresh } = await useFetch<AdminStoreContentState>(
  '/api/admin/store-content',
)
const form = ref<StorefrontContent | null>(null)
const busy = ref(false)
const uploading = ref('')
const uploadedUrls = ref<string[]>([])
const feedback = ref('')
const failure = ref(false)
const selectedPageKey = ref<StorePageKey>('home')
const previewLanguage = ref<'en' | 'ar'>('en')

const pageKeys: StorePageKey[] = [
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
]

watch(
  data,
  (value) => {
    if (value) {
      const draft = cloneStoreContent(value.draft)
      if (!draft.pages.drop.sections.some((section) => section.id === 'feature-banner')) {
        const featureBanner = DEFAULT_STORE_CONTENT.pages.drop.sections.find(
          (section) => section.id === 'feature-banner',
        )
        if (featureBanner) draft.pages.drop.sections.unshift(structuredClone(featureBanner))
      }
      form.value = draft
    }
  },
  { immediate: true },
)

const page = computed(() => form.value?.pages[selectedPageKey.value])
const dropBanner = computed(() =>
  page.value?.sections.find((section) => section.id === 'feature-banner'),
)
const pageSections = computed(() =>
  (page.value?.sections || []).filter(
    (section) => selectedPageKey.value !== 'drop' || section.id !== 'feature-banner',
  ),
)
const local = (value: { en: string; ar: string } | undefined) =>
  value?.[previewLanguage.value] || ''

function message(cause: unknown, fallback: string) {
  const issue = cause as { data?: { statusMessage?: string } }
  return issue.data?.statusMessage || fallback
}

async function saveDraft() {
  if (!form.value) return
  busy.value = true
  feedback.value = ''
  try {
    const result = await $fetch<AdminStoreContentState>('/api/admin/store-content/draft', {
      method: 'PUT',
      body: form.value,
    })
    data.value = result
    form.value = cloneStoreContent(result.draft)
    failure.value = false
    feedback.value = 'Draft saved. Customers still see the published version.'
  } catch (cause) {
    failure.value = true
    feedback.value = message(cause, 'The draft could not be saved.')
  } finally {
    busy.value = false
  }
}

async function publish() {
  if (!form.value) return
  busy.value = true
  feedback.value = ''
  try {
    const result = await $fetch<AdminStoreContentState>('/api/admin/store-content/publish', {
      method: 'POST',
      body: form.value,
    })
    data.value = result
    form.value = cloneStoreContent(result.draft)
    failure.value = false
    feedback.value = 'Changes published to the storefront.'
  } catch (cause) {
    failure.value = true
    feedback.value = message(cause, 'The changes could not be published.')
  } finally {
    busy.value = false
  }
}

async function restore(versionId: string) {
  busy.value = true
  feedback.value = ''
  try {
    const result = await $fetch<AdminStoreContentState>('/api/admin/store-content/restore', {
      method: 'POST',
      body: { versionId },
    })
    data.value = result
    form.value = cloneStoreContent(result.draft)
    failure.value = false
    feedback.value = 'Version restored to draft. Review it before publishing.'
  } catch (cause) {
    failure.value = true
    feedback.value = message(cause, 'The version could not be restored.')
  } finally {
    busy.value = false
  }
}

async function uploadImage(
  event: Event,
  target: 'logo' | 'defaultSocial' | 'hero' | 'mobileHero' | 'social',
) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !form.value) return
  uploading.value = target
  feedback.value = ''
  try {
    const body = new FormData()
    body.append('image', file)
    const result = await $fetch<{ url: string }>('/api/admin/media', { method: 'POST', body })
    uploadedUrls.value.push(result.url)
    if (target === 'logo') form.value.brand.logoUrl = result.url
    else if (target === 'defaultSocial') form.value.brand.defaultSocialImageUrl = result.url
    else if (page.value) {
      if (target === 'hero') page.value.hero.imageUrl = result.url
      else if (target === 'mobileHero') page.value.hero.mobileImageUrl = result.url
      else page.value.seo.socialImageUrl = result.url
    }
    failure.value = false
  } catch (cause) {
    failure.value = true
    feedback.value = message(cause, 'The image could not be uploaded.')
  } finally {
    uploading.value = ''
    input.value = ''
  }
}

function addNavigation() {
  if (!form.value) return
  const item: StoreNavigationItem = {
    id: `link-${Date.now()}`,
    label: { en: 'New link', ar: 'رابط جديد' },
    href: '/',
    enabled: true,
    desktop: true,
    mobile: true,
    mobileSection: 'main',
    footerColumn: 'none',
  }
  form.value.navigation.push(item)
}

function moveNavigation(index: number, direction: -1 | 1) {
  if (!form.value) return
  const next = index + direction
  if (next < 0 || next >= form.value.navigation.length) return
  const items = form.value.navigation
  const current = items[index]!
  items.splice(index, 1)
  items.splice(next, 0, current)
}

function addSection() {
  if (!page.value) return
  page.value.sections.push({
    id: `section-${Date.now()}`,
    eyebrow: { en: '', ar: '' },
    heading: { en: 'New section', ar: 'قسم جديد' },
    body: { en: '', ar: '' },
    ctaLabel: { en: '', ar: '' },
    ctaUrl: '/',
  })
}

function removeSection(id: string) {
  if (!page.value) return
  const index = page.value.sections.findIndex((section) => section.id === id)
  if (index !== -1) page.value.sections.splice(index, 1)
}

onBeforeUnmount(() => {
  for (const url of uploadedUrls.value) {
    $fetch('/api/admin/media', { method: 'DELETE', query: { url } }).catch(() => undefined)
  }
})
</script>

<template>
  <div v-if="status === 'pending' && !form" class="admin-orders-loading" role="status">
    <AdminLoader label="Loading store content" /><span />
  </div>
  <AdminEmptyState
    v-else-if="error || !form || !data"
    title="Store content unavailable"
    description="The content editor could not be loaded."
  >
    <template #actions><AdminButton @click="refresh()">Retry</AdminButton></template>
  </AdminEmptyState>
  <form v-else class="admin-content-editor" @submit.prevent="saveDraft">
    <p
      v-if="feedback"
      :class="failure ? 'admin-create-order__error' : 'admin-state-notice'"
      :role="failure ? 'alert' : 'status'"
    >
      {{ feedback }}
    </p>

    <section class="admin-content-editor__status">
      <div>
        <span>Working version</span
        ><strong>{{ data.hasUnpublishedChanges ? 'UNPUBLISHED CHANGES' : 'UP TO DATE' }}</strong>
      </div>
      <div class="admin-content-editor__actions">
        <AdminButton type="submit" variant="quiet" :disabled="busy">Save draft</AdminButton>
        <AdminButton type="button" :disabled="busy" @click="publish">Publish changes</AdminButton>
      </div>
    </section>

    <template v-if="props.view === 'brand'">
      <AdminSection
        title="Brand identity"
        description="Global name, logo, announcement bar, and footer language."
      >
        <div class="admin-content-editor__grid">
          <AdminInput v-model="form.brand.name" label="Brand name" maxlength="80" required />
          <AdminInput v-model="form.brand.tagline.en" label="English tagline" required />
          <AdminInput v-model="form.brand.tagline.ar" label="Arabic tagline" required dir="rtl" />
          <AdminInput v-model="form.brand.subline.en" label="English subline" required />
          <AdminInput v-model="form.brand.subline.ar" label="Arabic subline" required dir="rtl" />
        </div>
      </AdminSection>
      <AdminSection
        title="Logo and social sharing"
        description="Uploaded files stay in the KHT media library."
      >
        <div class="admin-content-editor__media-grid">
          <div class="admin-content-editor__media">
            <span>Header and footer logo</span
            ><img v-if="form.brand.logoUrl" :src="form.brand.logoUrl" alt="Current logo" />
            <label class="admin-product-media__upload"
              ><span>{{ uploading === 'logo' ? 'Uploading' : 'Upload logo' }}</span
              ><input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="uploadImage($event, 'logo')"
            /></label>
            <AdminButton
              v-if="form.brand.logoUrl"
              variant="quiet"
              @click="form.brand.logoUrl = null"
              >Use wordmark</AdminButton
            >
          </div>
          <div class="admin-content-editor__media">
            <span>Social sharing image</span
            ><img :src="form.brand.defaultSocialImageUrl" alt="Current social sharing" />
            <label class="admin-product-media__upload"
              ><span>{{ uploading === 'defaultSocial' ? 'Uploading' : 'Replace image' }}</span
              ><input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="uploadImage($event, 'defaultSocial')"
            /></label>
          </div>
        </div>
      </AdminSection>
      <AdminSection
        title="Announcement bar"
        description="The three messages across the top of every page."
      >
        <div class="admin-content-editor__grid">
          <template
            v-for="field in ['announcementStart', 'announcementCenter', 'announcementEnd'] as const"
            :key="field"
          >
            <AdminInput v-model="form.brand[field].en" :label="`English ${field}`" required />
            <AdminInput
              v-model="form.brand[field].ar"
              :label="`Arabic ${field}`"
              required
              dir="rtl"
            />
          </template>
        </div>
      </AdminSection>
      <AdminSection
        title="Contact and social links"
        description="Leave optional phone and social channels empty when unavailable."
      >
        <div class="admin-content-editor__grid">
          <AdminInput v-model="form.brand.contactEmail" label="Business email" type="email" />
          <AdminInput v-model="form.brand.contactPhone" label="Phone number" optional dir="ltr" />
          <AdminInput
            v-model="form.brand.contactWhatsApp"
            label="WhatsApp number"
            optional
            dir="ltr"
          />
          <AdminInput v-model="form.brand.instagramUrl" label="Instagram URL" optional />
          <AdminInput v-model="form.brand.facebookUrl" label="Facebook URL" optional />
          <AdminInput v-model="form.brand.tiktokUrl" label="TikTok URL" optional />
        </div>
      </AdminSection>
      <AdminSection
        title="Footer copy"
        description="Collection, customer care, statement, payment and legal labels."
      >
        <div class="admin-content-editor__grid">
          <template
            v-for="field in [
              'footerCollectionTitle',
              'footerCareTitle',
              'footerStatement',
              'footerStatementLinkLabel',
              'footerPaymentLine',
              'privacyLabel',
              'termsLabel',
            ] as const"
            :key="field"
          >
            <AdminInput v-model="form.brand[field].en" :label="`English ${field}`" required />
            <AdminInput
              v-model="form.brand[field].ar"
              :label="`Arabic ${field}`"
              required
              dir="rtl"
            />
          </template>
          <AdminInput
            v-model="form.brand.footerStatementLinkUrl"
            label="Footer statement destination"
            required
          />
        </div>
      </AdminSection>
    </template>

    <template v-else-if="props.view === 'navigation'">
      <AdminSection
        title="Store navigation"
        description="Reorder links and choose where each link appears."
      >
        <div class="admin-content-editor__list">
          <article
            v-for="(item, index) in form.navigation"
            :key="item.id"
            class="admin-content-editor__card"
          >
            <header>
              <strong>{{ index + 1 }} · {{ item.label.en }}</strong>
              <div>
                <button type="button" :disabled="index === 0" @click="moveNavigation(index, -1)">
                  Move up</button
                ><button
                  type="button"
                  :disabled="index === form.navigation.length - 1"
                  @click="moveNavigation(index, 1)"
                >
                  Move down</button
                ><button type="button" @click="form.navigation.splice(index, 1)">Remove</button>
              </div>
            </header>
            <div class="admin-content-editor__grid">
              <AdminInput v-model="item.label.en" label="English label" required />
              <AdminInput v-model="item.label.ar" label="Arabic label" required dir="rtl" />
              <AdminInput v-model="item.href" label="Destination" required />
              <AdminSelect v-model="item.mobileSection" label="Mobile section"
                ><option value="main">Main links</option>
                <option value="bottom">Bottom links</option></AdminSelect
              >
              <AdminSelect v-model="item.footerColumn" label="Footer column"
                ><option value="none">None</option>
                <option value="collection">Collection</option>
                <option value="care">Customer care</option></AdminSelect
              >
            </div>
            <div class="admin-content-editor__checks">
              <AdminCheckbox v-model="item.enabled" label="Enabled" /><AdminCheckbox
                v-model="item.desktop"
                label="Desktop header"
              /><AdminCheckbox v-model="item.mobile" label="Mobile menu" />
            </div>
          </article>
        </div>
        <AdminButton type="button" variant="quiet" @click="addNavigation"
          >Add navigation link</AdminButton
        >
      </AdminSection>
    </template>

    <template v-else-if="props.view === 'pages' && page">
      <AdminSection
        title="Choose a page"
        description="Edit its hero, page copy and search/social metadata."
      >
        <AdminSelect v-model="selectedPageKey" label="Page"
          ><option v-for="key in pageKeys" :key="key" :value="key">
            {{ form.pages[key].label }}
          </option></AdminSelect
        >
      </AdminSection>
      <div class="admin-content-editor__page-layout">
        <div>
          <AdminSection
            title="Page hero"
            description="Keep the hero off on focused utility pages unless it adds useful context."
          >
            <div class="admin-content-editor__checks">
              <AdminCheckbox v-model="page.hero.enabled" label="Show full hero" /><AdminCheckbox
                v-model="page.hero.ctaEnabled"
                label="Show hero button"
              />
            </div>
            <div class="admin-content-editor__grid">
              <AdminInput
                v-model="page.hero.eyebrow.en"
                label="English eyebrow"
                required
              /><AdminInput
                v-model="page.hero.eyebrow.ar"
                label="Arabic eyebrow"
                required
                dir="rtl"
              />
              <AdminTextarea
                v-model="page.hero.title.en"
                label="English title"
                required
              /><AdminTextarea
                v-model="page.hero.title.ar"
                label="Arabic title"
                required
                dir="rtl"
              />
              <AdminTextarea
                v-model="page.hero.body.en"
                label="English introduction"
                required
              /><AdminTextarea
                v-model="page.hero.body.ar"
                label="Arabic introduction"
                required
                dir="rtl"
              />
              <template v-if="selectedPageKey !== 'drop'">
                <AdminInput
                  v-model="page.hero.imageAlt.en"
                  label="English image description"
                  required
                /><AdminInput
                  v-model="page.hero.imageAlt.ar"
                  label="Arabic image description"
                  required
                  dir="rtl"
                />
              </template>
              <template v-if="page.hero.ctaEnabled"
                ><AdminInput
                  v-model="page.hero.ctaLabel.en"
                  label="English button label"
                  required /><AdminInput
                  v-model="page.hero.ctaLabel.ar"
                  label="Arabic button label"
                  required
                  dir="rtl" /><AdminInput
                  v-model="page.hero.ctaUrl"
                  label="Button destination"
                  required
              /></template>
            </div>
            <div v-if="selectedPageKey !== 'drop'" class="admin-content-editor__media-grid">
              <div class="admin-content-editor__media">
                <span>Desktop hero image</span
                ><img
                  v-if="page.hero.imageUrl"
                  :src="page.hero.imageUrl"
                  :alt="page.hero.imageAlt.en"
                /><label class="admin-product-media__upload"
                  ><span>Upload desktop image</span
                  ><input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    @change="uploadImage($event, 'hero')" /></label
                ><AdminButton
                  v-if="page.hero.imageUrl"
                  variant="quiet"
                  @click="page.hero.imageUrl = null"
                  >Remove</AdminButton
                >
              </div>
              <div class="admin-content-editor__media">
                <span>Mobile hero image</span
                ><img
                  v-if="page.hero.mobileImageUrl"
                  :src="page.hero.mobileImageUrl"
                  :alt="page.hero.imageAlt.en"
                /><label class="admin-product-media__upload"
                  ><span>Upload mobile image</span
                  ><input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    @change="uploadImage($event, 'mobileHero')" /></label
                ><AdminButton
                  v-if="page.hero.mobileImageUrl"
                  variant="quiet"
                  @click="page.hero.mobileImageUrl = null"
                  >Use desktop image</AdminButton
                >
              </div>
            </div>
          </AdminSection>
          <AdminSection
            v-if="selectedPageKey === 'drop' && dropBanner"
            title="Drop 001 feature banner"
            description="Controls the product image and the black text panel shown above the Drop 001 products."
          >
            <div class="admin-content-editor__grid">
              <AdminInput
                v-model="dropBanner.heading.en"
                label="English banner text"
                required
              /><AdminInput
                v-model="dropBanner.heading.ar"
                label="Arabic banner text"
                required
                dir="rtl"
              /><AdminInput
                v-model="page.hero.imageAlt.en"
                label="English image description"
                required
              /><AdminInput
                v-model="page.hero.imageAlt.ar"
                label="Arabic image description"
                required
                dir="rtl"
              />
            </div>
            <div class="admin-content-editor__media-grid">
              <div class="admin-content-editor__media">
                <span>Desktop banner image</span
                ><img
                  v-if="page.hero.imageUrl"
                  :src="page.hero.imageUrl"
                  :alt="page.hero.imageAlt.en"
                /><label class="admin-product-media__upload"
                  ><span>Upload desktop banner</span
                  ><input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    @change="uploadImage($event, 'hero')" /></label
                ><AdminButton
                  v-if="page.hero.imageUrl"
                  type="button"
                  variant="quiet"
                  @click="page.hero.imageUrl = null"
                  >Remove</AdminButton
                >
              </div>
              <div class="admin-content-editor__media">
                <span>Mobile banner image</span
                ><img
                  v-if="page.hero.mobileImageUrl"
                  :src="page.hero.mobileImageUrl"
                  :alt="page.hero.imageAlt.en"
                /><label class="admin-product-media__upload"
                  ><span>Upload mobile banner</span
                  ><input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    @change="uploadImage($event, 'mobileHero')" /></label
                ><AdminButton
                  v-if="page.hero.mobileImageUrl"
                  type="button"
                  variant="quiet"
                  @click="page.hero.mobileImageUrl = null"
                  >Use desktop image</AdminButton
                >
              </div>
            </div>
          </AdminSection>
          <AdminSection
            title="Page sections"
            description="Reorder by dragging is intentionally avoided; use clear section controls."
          >
            <article
              v-for="(section, index) in pageSections"
              :key="section.id"
              class="admin-content-editor__card"
            >
              <header>
                <strong>{{ index + 1 }} · {{ section.heading.en }}</strong
                ><button type="button" @click="removeSection(section.id)">Remove</button>
              </header>
              <div class="admin-content-editor__grid">
                <AdminInput
                  v-model="section.eyebrow.en"
                  label="English eyebrow"
                  optional
                /><AdminInput
                  v-model="section.eyebrow.ar"
                  label="Arabic eyebrow"
                  optional
                  dir="rtl"
                /><AdminInput
                  v-model="section.heading.en"
                  label="English heading"
                  required
                /><AdminInput
                  v-model="section.heading.ar"
                  label="Arabic heading"
                  required
                  dir="rtl"
                /><AdminTextarea
                  v-model="section.body.en"
                  label="English body"
                  optional
                /><AdminTextarea
                  v-model="section.body.ar"
                  label="Arabic body"
                  optional
                  dir="rtl"
                /><AdminInput
                  v-model="section.ctaLabel.en"
                  label="English link label"
                  optional
                /><AdminInput
                  v-model="section.ctaLabel.ar"
                  label="Arabic link label"
                  optional
                  dir="rtl"
                /><AdminInput v-model="section.ctaUrl" label="Link destination" required />
              </div>
            </article>
            <AdminButton type="button" variant="quiet" @click="addSection"
              >Add content section</AdminButton
            >
          </AdminSection>
          <AdminSection
            title="SEO and social sharing"
            description="This controls Google result text and the image shown on WhatsApp and social media."
          >
            <div class="admin-content-editor__grid">
              <AdminInput
                v-model="page.seo.title.en"
                label="English SEO title"
                required
                maxlength="120"
              /><AdminInput
                v-model="page.seo.title.ar"
                label="Arabic SEO title"
                required
                maxlength="120"
                dir="rtl"
              /><AdminTextarea
                v-model="page.seo.description.en"
                label="English SEO description"
                required
                maxlength="320"
              /><AdminTextarea
                v-model="page.seo.description.ar"
                label="Arabic SEO description"
                required
                maxlength="320"
                dir="rtl"
              />
            </div>
            <div class="admin-content-editor__media">
              <span>Social sharing image</span
              ><img
                v-if="page.seo.socialImageUrl"
                :src="page.seo.socialImageUrl"
                :alt="page.hero.imageAlt.en"
              /><label class="admin-product-media__upload"
                ><span>Upload social image</span
                ><input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  @change="uploadImage($event, 'social')" /></label
              ><AdminButton
                v-if="page.seo.socialImageUrl"
                variant="quiet"
                @click="page.seo.socialImageUrl = null"
                >Use default image</AdminButton
              >
            </div>
          </AdminSection>
        </div>
        <aside class="admin-content-editor__preview">
          <header>
            <span>Page preview</span>
            <div>
              <button
                type="button"
                :aria-pressed="previewLanguage === 'en'"
                @click="previewLanguage = 'en'"
              >
                EN</button
              ><button
                type="button"
                :aria-pressed="previewLanguage === 'ar'"
                @click="previewLanguage = 'ar'"
              >
                AR
              </button>
            </div>
          </header>
          <div :dir="previewLanguage === 'ar' ? 'rtl' : 'ltr'">
            <img
              v-if="page.hero.imageUrl"
              :src="page.hero.imageUrl"
              :alt="local(page.hero.imageAlt)"
            /><small>{{ local(page.hero.eyebrow) }}</small>
            <h2>{{ local(page.hero.title) }}</h2>
            <p>{{ local(page.hero.body) }}</p>
            <span v-if="page.hero.ctaEnabled">{{ local(page.hero.ctaLabel) }}</span>
          </div>
        </aside>
      </div>
    </template>

    <template v-else-if="props.view === 'publishing'">
      <AdminSection
        title="Publishing"
        description="Save work privately, preview pages, then publish all changes together."
      >
        <dl class="admin-content-editor__publishing">
          <div>
            <dt>Draft</dt>
            <dd>
              {{
                data.draftUpdatedAt
                  ? new Date(data.draftUpdatedAt).toLocaleString('en-EG')
                  : 'Compiled default'
              }}
              · {{ data.draftUpdatedBy }}
            </dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>
              {{
                data.publishedAt
                  ? new Date(data.publishedAt).toLocaleString('en-EG')
                  : 'Compiled default'
              }}
              · {{ data.publishedBy }}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {{
                data.hasUnpublishedChanges
                  ? 'Draft has changes waiting to publish'
                  : 'Published content is up to date'
              }}
            </dd>
          </div>
        </dl>
      </AdminSection>
      <AdminSection
        title="Version history"
        description="Restoring creates a draft first, so the live site never changes by accident."
      >
        <div v-if="data.versions.length" class="admin-content-editor__versions">
          <article v-for="version in data.versions" :key="version.id">
            <div>
              <strong>{{ new Date(version.publishedAt).toLocaleString('en-EG') }}</strong
              ><span>{{ version.publishedBy }}</span>
            </div>
            <AdminButton type="button" variant="quiet" :disabled="busy" @click="restore(version.id)"
              >Restore to draft</AdminButton
            >
          </article>
        </div>
        <p v-else class="admin-field__help">
          Version history begins after the first content publish.
        </p>
      </AdminSection>
    </template>
  </form>
</template>
