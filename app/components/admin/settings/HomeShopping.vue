<script setup lang="ts">
import type {
  HomeShoppingCard,
  HomeShoppingContent,
  StoreContentSection,
} from '#shared/storeContent'
import type { Product } from '#shared/types'
import { startingPrice } from '#shared/productPricing'

const props = defineProps<{
  shopping: HomeShoppingContent
  section: StoreContentSection
  catalog: Product[]
}>()
const uploading = ref('')
const error = ref('')
const uploadedUrls = ref<string[]>([])
const productFor = (slug: string) => props.catalog.find((product) => product.slug === slug)
const priceFor = (slug: string) => {
  const product = productFor(slug)
  return product
    ? `EGP ${new Intl.NumberFormat('en-EG').format(startingPrice(product))}`
    : 'Product unavailable'
}

function addCard() {
  if (props.shopping.cards.length >= 6) return
  const card: HomeShoppingCard = {
    id: `look-${Date.now()}`,
    enabled: true,
    productSlug: props.catalog[0]?.slug || props.shopping.heroProductSlug,
    eyebrow: { en: 'NEW LOOK', ar: 'إطلالة جديدة' },
    heading: { en: 'New look', ar: 'إطلالة جديدة' },
    body: { en: 'Discover this piece.', ar: 'اكتشف القطعة.' },
    imageUrl: null,
    mobileImageUrl: null,
    imageAlt: { en: 'KHT product', ar: 'منتج KHT' },
    ctaLabel: { en: 'Shop now', ar: 'تسوق الآن' },
    useProductLink: true,
    ctaUrl: '/shop',
    showPrice: true,
  }
  props.shopping.cards.push(card)
}
function moveCard(index: number, direction: -1 | 1) {
  const cards = props.shopping.cards
  const next = index + direction
  if (next < 0 || next >= cards.length) return
  const card = cards[index]!
  cards.splice(index, 1)
  cards.splice(next, 0, card)
}
async function uploadImage(event: Event, card: HomeShoppingCard, mobile: boolean) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = `${card.id}-${mobile ? 'mobile' : 'desktop'}`
  error.value = ''
  try {
    const body = new FormData()
    body.append('image', file)
    const result = await $fetch<{ url: string }>('/api/admin/media', { method: 'POST', body })
    uploadedUrls.value.push(result.url)
    if (mobile) card.mobileImageUrl = result.url
    else card.imageUrl = result.url
  } catch (cause) {
    const issue = cause as { data?: { statusMessage?: string } }
    error.value = issue.data?.statusMessage || 'The image could not be uploaded.'
  } finally {
    uploading.value = ''
    input.value = ''
  }
}
onBeforeUnmount(() => {
  for (const url of uploadedUrls.value)
    $fetch('/api/admin/media', { method: 'DELETE', query: { url } }).catch(() => undefined)
})
</script>

<template>
  <AdminSection
    title="Homepage shopping hero"
    description="Choose the product behind the main button. Hero copy and desktop/mobile images are editable in Page hero above. Price follows the catalog automatically."
  >
    <div class="admin-content-editor__grid">
      <AdminSelect v-model="shopping.heroProductSlug" label="Featured product">
        <option v-if="!productFor(shopping.heroProductSlug)" :value="shopping.heroProductSlug">
          Unavailable product · choose another
        </option>
        <option v-for="product in catalog" :key="product.id" :value="product.slug">
          {{ product.name.en }} · {{ priceFor(product.slug) }}
        </option>
      </AdminSelect>
      <AdminInput v-model="shopping.heroPricePrefix.en" label="English price prefix" required />
      <AdminInput
        v-model="shopping.heroPricePrefix.ar"
        label="Arabic price prefix"
        required
        dir="rtl"
      />
      <AdminInput v-model="shopping.heroCaption.en" label="English image caption" optional />
      <AdminInput
        v-model="shopping.heroCaption.ar"
        label="Arabic image caption"
        optional
        dir="rtl"
      />
      <AdminInput v-model="shopping.heroScrollLabel.en" label="English scroll label" optional />
      <AdminInput
        v-model="shopping.heroScrollLabel.ar"
        label="Arabic scroll label"
        optional
        dir="rtl"
      />
    </div>
    <div class="admin-content-editor__checks">
      <AdminCheckbox
        v-model="shopping.heroUseProductLink"
        label="Main button opens featured product"
      />
      <AdminCheckbox v-model="shopping.heroShowPrice" label="Show live starting price" />
      <AdminCheckbox v-model="shopping.secondaryEnabled" label="Show second button" />
    </div>
    <div v-if="shopping.secondaryEnabled" class="admin-content-editor__grid">
      <AdminInput v-model="shopping.secondaryLabel.en" label="English second button" required />
      <AdminInput
        v-model="shopping.secondaryLabel.ar"
        label="Arabic second button"
        required
        dir="rtl"
      />
      <AdminInput
        v-model="shopping.secondaryUrl"
        label="Second button destination"
        required
        help="Use /#collection to scroll to the looks."
      />
    </div>
  </AdminSection>
  <AdminSection
    title="Homepage message strip"
    description="Three short messages between the hero and the looks."
  >
    <div class="admin-content-editor__checks">
      <AdminCheckbox v-model="shopping.stripEnabled" label="Show message strip" />
    </div>
    <div class="admin-content-editor__grid">
      <AdminInput v-model="shopping.stripStart.en" label="English first message" required />
      <AdminInput
        v-model="shopping.stripStart.ar"
        label="Arabic first message"
        required
        dir="rtl"
      />
      <AdminInput v-model="shopping.stripCenter.en" label="English middle message" required />
      <AdminInput
        v-model="shopping.stripCenter.ar"
        label="Arabic middle message"
        required
        dir="rtl"
      />
      <AdminInput v-model="shopping.stripEnd.en" label="English last message" required />
      <AdminInput v-model="shopping.stripEnd.ar" label="Arabic last message" required dir="rtl" />
    </div>
  </AdminSection>
  <AdminSection
    title="Shop the look"
    description="Choose products, reorder cards, and edit every image, caption, and link. Prices remain synced with the catalog."
  >
    <div class="admin-content-editor__checks">
      <AdminCheckbox v-model="shopping.sectionEnabled" label="Show shop-the-look section" />
      <AdminCheckbox v-model="shopping.sectionShowAllLink" label="Show all-products link" />
      <AdminCheckbox v-model="shopping.sectionShowFooter" label="Show section footer" />
    </div>
    <div class="admin-content-editor__grid">
      <AdminInput v-model="section.eyebrow.en" label="English section eyebrow" optional />
      <AdminInput v-model="section.eyebrow.ar" label="Arabic section eyebrow" optional dir="rtl" />
      <AdminInput v-model="section.heading.en" label="English section title" required />
      <AdminInput v-model="section.heading.ar" label="Arabic section title" required dir="rtl" />
      <AdminInput v-model="section.body.en" label="English section footer" optional />
      <AdminInput v-model="section.body.ar" label="Arabic section footer" optional dir="rtl" />
      <AdminInput v-model="section.ctaLabel.en" label="English all-products link" optional />
      <AdminInput
        v-model="section.ctaLabel.ar"
        label="Arabic all-products link"
        optional
        dir="rtl"
      />
      <AdminInput v-model="section.ctaUrl" label="All-products destination" required />
    </div>
    <p v-if="error" class="admin-create-order__error" role="alert">{{ error }}</p>
    <article
      v-for="(card, index) in shopping.cards"
      :key="card.id"
      class="admin-content-editor__card"
    >
      <header>
        <strong>{{ index + 1 }} · {{ card.heading.en }}</strong>
        <div>
          <button type="button" :disabled="index === 0" @click="moveCard(index, -1)">
            Move up
          </button>
          <button
            type="button"
            :disabled="index === shopping.cards.length - 1"
            @click="moveCard(index, 1)"
          >
            Move down
          </button>
          <button type="button" @click="shopping.cards.splice(index, 1)">Remove</button>
        </div>
      </header>
      <div class="admin-content-editor__checks">
        <AdminCheckbox v-model="card.enabled" label="Show card" />
        <AdminCheckbox v-model="card.showPrice" label="Show live price" />
        <AdminCheckbox v-model="card.useProductLink" label="Button opens selected product" />
      </div>
      <div class="admin-content-editor__grid">
        <AdminSelect v-model="card.productSlug" label="Product">
          <option v-if="!productFor(card.productSlug)" :value="card.productSlug">
            Unavailable product · choose another
          </option>
          <option v-for="product in catalog" :key="product.id" :value="product.slug">
            {{ product.name.en }} · {{ priceFor(product.slug) }}
          </option>
        </AdminSelect>
        <AdminInput
          v-if="!card.useProductLink"
          v-model="card.ctaUrl"
          label="Custom destination"
          required
        />
        <AdminInput v-model="card.eyebrow.en" label="English eyebrow" required />
        <AdminInput v-model="card.eyebrow.ar" label="Arabic eyebrow" required dir="rtl" />
        <AdminInput v-model="card.heading.en" label="English heading" required />
        <AdminInput v-model="card.heading.ar" label="Arabic heading" required dir="rtl" />
        <AdminTextarea v-model="card.body.en" label="English description" required />
        <AdminTextarea v-model="card.body.ar" label="Arabic description" required dir="rtl" />
        <AdminInput v-model="card.ctaLabel.en" label="English button" required />
        <AdminInput v-model="card.ctaLabel.ar" label="Arabic button" required dir="rtl" />
        <AdminInput v-model="card.imageAlt.en" label="English image description" required />
        <AdminInput
          v-model="card.imageAlt.ar"
          label="Arabic image description"
          required
          dir="rtl"
        />
      </div>
      <div class="admin-content-editor__media-grid">
        <div class="admin-content-editor__media">
          <span>Desktop card image</span>
          <img
            v-if="card.imageUrl || productFor(card.productSlug)?.image"
            :src="card.imageUrl || productFor(card.productSlug)?.image || ''"
            :alt="card.imageAlt.en"
          />
          <label class="admin-product-media__upload"
            ><span>{{
              uploading === `${card.id}-desktop` ? 'Uploading…' : 'Upload desktop image'
            }}</span
            ><input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="!!uploading"
              @change="uploadImage($event, card, false)"
          /></label>
          <AdminButton
            v-if="card.imageUrl"
            type="button"
            variant="quiet"
            @click="card.imageUrl = null"
            >Use product image</AdminButton
          >
        </div>
        <div class="admin-content-editor__media">
          <span>Mobile card image</span>
          <img v-if="card.mobileImageUrl" :src="card.mobileImageUrl" :alt="card.imageAlt.en" />
          <label class="admin-product-media__upload"
            ><span>{{
              uploading === `${card.id}-mobile` ? 'Uploading…' : 'Upload mobile image'
            }}</span
            ><input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="!!uploading"
              @change="uploadImage($event, card, true)"
          /></label>
          <AdminButton
            v-if="card.mobileImageUrl"
            type="button"
            variant="quiet"
            @click="card.mobileImageUrl = null"
            >Use desktop image</AdminButton
          >
        </div>
      </div>
    </article>
    <AdminButton v-if="shopping.cards.length < 6" type="button" variant="quiet" @click="addCard"
      >Add look card</AdminButton
    >
  </AdminSection>
</template>
