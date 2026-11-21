<script setup lang="ts">
import { STORE_ORIGIN, absoluteStoreUrl, breadcrumbList } from '#shared/storefrontSeo'
import { hasSizePriceRange, sizePrice, startingPrice } from '#shared/productPricing'
import { DEFAULT_HOME_SHOPPING } from '#shared/storeContent'
import { fullSetDiscountPercent } from '#shared/setOffer'
import type { KhtSetSize } from '#shared/sizeRecommendation'
import type { ProductReviewResponse } from '#shared/productReview'
import { khtWhatsAppLink } from '#shared/whatsapp'

const route = useRoute()
const { t, localized, money, locale } = useLanguage()
const catalog = useCatalog()
const product = computed(() => catalog.value.products.find((p) => p.slug === route.params.slug))
if (!product.value) throw createError({ statusCode: 404, statusMessage: 'Piece not found' })
const { data: reviewData } = await useFetch<ProductReviewResponse>(
  () => `/api/products/${encodeURIComponent(product.value!.id)}/reviews`,
)
const reviewCount = computed(() => reviewData.value?.count || 0)
const reviewAverage = computed(() => reviewData.value?.average || 0)
const featuredReview = computed(() => reviewData.value?.reviews?.[0])
const reviewOpen = ref(false)
const reviewBusy = ref(false)
const reviewError = ref('')
const reviewSuccess = ref('')
const reviewForm = reactive({ reference: '', phone: '', displayName: '', rating: 5, body: '' })
const productHighlights = computed(() => {
  const details = localized(product.value!.detail)
  const points = details
    .split(/\r?\n|;\s*/)
    .map((line) => line.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean)
  return points.slice(0, 6)
})
const productIntro = computed(() => localized(product.value!.description).split(/\n\s*\n/)[0] || '')
async function submitReview() {
  if (!product.value || reviewBusy.value) return
  reviewBusy.value = true
  reviewError.value = ''
  reviewSuccess.value = ''
  try {
    await $fetch(`/api/products/${encodeURIComponent(product.value.id)}/reviews`, {
      method: 'POST',
      body: reviewForm,
    })
    reviewSuccess.value = t(
      'Thank you. Your verified review is awaiting approval.',
      'شكرًا لك. رأيك بعد التحقق في انتظار المراجعة قبل ظهوره.',
    )
    reviewOpen.value = false
    reviewForm.body = ''
  } catch (cause: unknown) {
    const failure = cause as { data?: { statusMessage?: string } }
    const message = failure.data?.statusMessage || ''
    reviewError.value = message.includes('already exists')
      ? t(
          'This order already has a review for this product.',
          'تم إرسال رأي لهذا المنتج من نفس الطلب بالفعل.',
        )
      : message.includes('delivered order')
        ? t(
            'Check the order number and phone. Reviews open after delivery.',
            'تأكد من رقم الطلب والموبايل. الآراء متاحة بعد تسليم الطلب.',
          )
        : t('Check all fields and try again.', 'راجع البيانات وجرب تاني.')
  } finally {
    reviewBusy.value = false
  }
}
const { trackViewItem, trackAddToCart } = useStoreAnalytics()
watch(
  () => product.value?.id,
  () => {
    if (product.value) trackViewItem(product.value)
  },
  { immediate: true },
)
const category = computed(() =>
  catalog.value.categories.find((c) => c.slug === product.value?.category),
)
const selectedSize = useState('kht-whatsapp-product-size', () => '')
const displayedPrice = computed(() =>
  product.value
    ? selectedSize.value
      ? sizePrice(product.value, selectedSize.value)
      : startingPrice(product.value)
    : 0,
)
const priceStartsAt = computed(
  () => !!product.value && !selectedSize.value && hasSizePriceRange(product.value),
)
const selectedImageIndex = ref(0)
const productImages = computed(() =>
  product.value?.images?.length ? product.value.images : product.value ? [product.value.image] : [],
)
const selectedImage = computed(
  () => productImages.value[selectedImageIndex.value] || product.value?.image || '',
)
const fullSet = computed(() =>
  catalog.value.products.find(
    (item) =>
      item.slug ===
      DEFAULT_HOME_SHOPPING.cards.find((card) => card.id === 'full-look')?.productSlug,
  ),
)
const showSizeFinder = computed(() => product.value?.id === fullSet.value?.id)
const finderAvailableSizes = computed(
  () =>
    product.value?.sizes
      .filter((size) => size.stock > 0 && (size.name === 'M' || size.name === 'L'))
      .map((size) => size.name) || [],
)
const setSaving = computed(() =>
  product.value?.id === fullSet.value?.id
    ? fullSetDiscountPercent(catalog.value, selectedSize.value || undefined)
    : 0,
)
const storeContent = useStoreContent()
const policy = computed(() => storeContent.value.policyHighlights)
const productWhatsApp = computed(() =>
  khtWhatsAppLink(
    t(
      `Hello KHT, I have a question about ${localized(product.value!.name)}. Size: ${selectedSize.value || 'not selected yet'}.`,
      `أهلاً KHT، عندي استفسار عن ${localized(product.value!.name)}. المقاس: ${selectedSize.value || 'لسه ما اخترتش'}.`,
    ),
  ),
)
const fabricDescription = computed(() => {
  const explicit = product.value?.fabric
  if (explicit?.en && explicit?.ar) return localized(explicit)
  return (
    localized(product.value!.detail)
      .split(/\r?\n/)
      .find((line) => /Milton|ميلتون/i.test(line))
      ?.replace(/^[•\-\s]+/, '')
      .trim() || ''
  )
})
const gsm = computed(() => {
  const text = `${product.value?.fabric?.en || ''} ${product.value?.fabric?.ar || ''}`
  return text.match(/\b\d{3,4}\s*GSM\b/i)?.[0] || ''
})
const message = ref('')
const zoom = ref(false)
const actualSize = ref(true)
const sizeGuide = ref(false)
const sizeFinderOpen = ref(false)
const sizingAssistanceUrl = productWhatsApp
const activeInfoTab = ref<'fit' | 'care' | 'delivery' | 'returns'>('fit')
function moveInfoTab(event: KeyboardEvent) {
  const tabs = ['fit', 'care', 'delivery', 'returns'] as const
  let index = tabs.indexOf(activeInfoTab.value)
  if (event.key === 'Home') index = 0
  else if (event.key === 'End') index = tabs.length - 1
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const offset = (event.key === 'ArrowRight' ? 1 : -1) * (locale.value === 'ar' ? -1 : 1)
    index = (index + offset + tabs.length) % tabs.length
  } else return
  event.preventDefault()
  activeInfoTab.value = tabs[index]!
  nextTick(() => document.getElementById(`product-tab-${activeInfoTab.value}`)?.focus())
}
const buying = ref(false)
function selectSize(size: string) {
  selectedSize.value = size
  message.value = ''
}
function applyFinderSize(size: KhtSetSize) {
  if (!finderAvailableSizes.value.includes(size)) return
  selectSize(size)
  sizeFinderOpen.value = false
}
async function showSizeGuideFromFinder() {
  sizeFinderOpen.value = false
  await nextTick()
  sizeGuide.value = true
}
function moveImage(direction: number) {
  if (productImages.value.length < 2) return
  selectedImageIndex.value =
    (selectedImageIndex.value + direction + productImages.value.length) % productImages.value.length
}
let touchStartX = 0
let touchStartY = 0
function startSwipe(event: TouchEvent) {
  touchStartX = event.changedTouches[0]?.clientX || 0
  touchStartY = event.changedTouches[0]?.clientY || 0
}
function endSwipe(event: TouchEvent) {
  const dx = (event.changedTouches[0]?.clientX || 0) - touchStartX
  const dy = (event.changedTouches[0]?.clientY || 0) - touchStartY
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) moveImage(dx < 0 ? 1 : -1)
}
const bag = useBag()
const sizesElement = ref<HTMLElement>()
const buyElement = ref<HTMLElement>()
const stickyVisible = ref(false)
let observer: IntersectionObserver | undefined
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    stickyVisible.value = !!entry && !entry.isIntersecting && entry.boundingClientRect.top < 0
  })
  if (buyElement.value) observer.observe(buyElement.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => route.params.slug,
  () => {
    selectedSize.value = ''
    selectedImageIndex.value = 0
    message.value = ''
    reviewOpen.value = false
    reviewError.value = ''
    reviewSuccess.value = ''
  },
)
function promptSize() {
  message.value = t('Choose an available size first.', 'اختار مقاس متاح الأول.')
  sizesElement.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  sizesElement.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
}
async function addToBag(checkout = false) {
  if (!selectedSize.value) {
    promptSize()
    return
  }
  if (!product.value || buying.value) return
  buying.value = true
  message.value = ''
  if (!bag.add(product.value, selectedSize.value)) {
    message.value = t(
      'The available quantity is already in your bag, or your bag is full.',
      'الكمية المتاحة موجودة بالفعل في سلتك، أو السلة ممتلئة.',
    )
  } else {
    trackAddToCart(product.value, selectedSize.value)
    if (checkout) {
      bag.open.value = false
      await navigateTo('/checkout')
    }
  }
  buying.value = false
}
const canonicalPath = computed(
  () => `/products/${product.value?.slug || String(route.params.slug)}`,
)
const seoTitle = computed(() =>
  product.value ? `${localized(product.value.name)} — KHT Egypt` : 'KHT Product',
)
const seoDescription = computed(() =>
  product.value ? localized(product.value.description) : 'Discover KHT Drop 001.',
)
const structuredData = computed(() => {
  const item = product.value!
  const inStock = item.sizes.some((size) => size.stock > 0)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${absoluteStoreUrl(canonicalPath.value)}#product`,
        name: localized(item.name),
        description: localized(item.description),
        sku: item.code,
        image: item.images.map(absoluteStoreUrl),
        color: t('Black / White', 'أسود / أبيض'),
        size: item.sizes.map((size) => size.name),
        category: category.value ? localized(category.value.name) : undefined,
        brand: { '@type': 'Brand', name: 'KHT' },
        ...(reviewCount.value
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: reviewAverage.value.toFixed(1),
                reviewCount: reviewCount.value,
              },
            }
          : {}),
        offers: {
          '@type': 'Offer',
          url: absoluteStoreUrl(canonicalPath.value),
          priceCurrency: 'EGP',
          price: startingPrice(item).toFixed(2),
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@id': `${STORE_ORIGIN}/#store` },
        },
      },
      breadcrumbList([
        { name: 'KHT', path: '/' },
        { name: t('Collection', 'المجموعة'), path: '/shop' },
        ...(category.value
          ? [{ name: localized(category.value.name), path: `/categories/${category.value.slug}` }]
          : []),
        { name: localized(item.name), path: canonicalPath.value },
      ]),
    ],
  }
})
useStoreSeo({
  title: seoTitle,
  description: seoDescription,
  path: canonicalPath,
  image: computed(() => product.value!.image),
  imageAlt: computed(() => localized(product.value!.name)),
  structuredData,
})
</script>
<template>
  <main v-if="product" id="main" class="product-page light-surface">
    <nav class="breadcrumbs">
      <NuxtLink to="/shop">{{ t('Collection', 'المجموعة') }}</NuxtLink
      ><span>/</span
      ><NuxtLink :to="`/categories/${product.category}`">{{
        category ? localized(category.name) : ''
      }}</NuxtLink
      ><span>/</span><span>{{ localized(product.name) }}</span>
    </nav>
    <div class="product-detail-grid">
      <div class="product-gallery" @touchstart.passive="startSwipe" @touchend.passive="endSwipe">
        <div class="mobile-product-summary">
          <strong>{{ localized(product.name) }}</strong
          ><ProductPrice
            :price="displayedPrice"
            :compare-at-price="product.compareAtPrice"
            :from="priceStartsAt"
          />
          <WelcomePriceHint :price="displayedPrice" :product-slug="product.slug" compact />
        </div>
        <button
          class="product-main-image"
          :aria-label="t('Enlarge product image', 'كبّر صورة المنتج')"
          @click="zoom = true"
        >
          <StoreImage
            :src="selectedImage"
            sizes="(max-width: 767px) 100vw, 55vw"
            :alt="`${localized(product.name)} — ${t('image', 'صورة')} ${selectedImageIndex + 1}`"
            width="1086"
            height="1448"
            fetchpriority="high"
          />
        </button>
        <div v-if="productImages.length > 1" class="product-gallery-nav">
          <button
            type="button"
            :aria-label="t('Previous image', 'الصورة السابقة')"
            @click="moveImage(-1)"
          >
            ‹
          </button>
          <span aria-live="polite">{{ selectedImageIndex + 1 }} / {{ productImages.length }}</span>
          <button
            type="button"
            :aria-label="t('Next image', 'الصورة التالية')"
            @click="moveImage(1)"
          >
            ›
          </button>
        </div>
        <div
          v-if="productImages.length > 1"
          class="product-thumbnails"
          role="group"
          :aria-label="t('Product images', 'صور المنتج')"
        >
          <button
            v-for="(image, index) in productImages"
            :key="image"
            type="button"
            class="product-thumbnail"
            :class="{ selected: selectedImageIndex === index }"
            :aria-pressed="selectedImageIndex === index"
            :aria-label="`${t('Show image', 'اعرض الصورة')} ${index + 1}`"
            @click="selectedImageIndex = index"
          >
            <StoreImage
              :src="image"
              sizes="88px"
              :alt="`${localized(product.name)} — ${t('image', 'صورة')} ${index + 1}`"
              loading="lazy"
            />
          </button>
        </div>
        <span class="image-note">{{
          t(
            `Product image ${selectedImageIndex + 1} of ${productImages.length}`,
            `صورة المنتج ${selectedImageIndex + 1} من ${productImages.length}`,
          )
        }}</span>
      </div>
      <div class="product-details">
        <p class="eyebrow">DROP 001</p>
        <h1>{{ localized(product.name) }}</h1>
        <p class="detail-product-code">{{ product.code }}</p>
        <a v-if="reviewCount" class="product-review-link" href="#product-reviews">
          <span aria-hidden="true">★</span> {{ reviewAverage.toFixed(1) }} · {{ reviewCount }}
          {{ t('verified reviews', 'تقييمات من مشترين') }}
        </a>
        <ProductPrice
          class="detail-price"
          :price="displayedPrice"
          :compare-at-price="product.compareAtPrice"
          :from="priceStartsAt"
        />
        <WelcomePriceHint :price="displayedPrice" :product-slug="product.slug" />
        <p v-if="setSaving" class="set-saving">
          {{
            t(
              `Choose the Full Set and save around ${setSaving}% compared with the pieces separately.`,
              `اختار الطقم الكامل ووفر حوالي ${setSaving}٪ مقارنة بشراء القطع منفصلة.`,
            )
          }}
        </p>
        <div class="product-at-a-glance">
          <p class="product-description">{{ productIntro }}</p>
          <ul v-if="productHighlights.length">
            <li v-for="point in productHighlights" :key="point">{{ point }}</li>
          </ul>
        </div>
        <div class="color-choice">
          <span class="color-swatch" /><span>{{ t('Black / White', 'أسود / أبيض') }}</span>
        </div>
        <div ref="sizesElement" class="size-section">
          <div class="size-heading">
            <span
              >{{ t('Select size', 'اختار مقاسك')
              }}<b v-if="selectedSize"> / {{ selectedSize }}</b></span
            >
            <div class="size-heading__actions">
              <button
                v-if="showSizeFinder"
                type="button"
                class="size-finder-trigger"
                @click="sizeFinderOpen = true"
              >
                {{ t('Find my size', 'اختار مقاسي') }}
              </button>
              <button type="button" class="remove-link" @click="sizeGuide = true">
                {{ t('Size guide', 'دليل المقاسات') }}
              </button>
            </div>
          </div>
          <div class="size-options" role="group" :aria-label="t('Size', 'المقاس')">
            <button
              v-for="size in product.sizes"
              :key="size.name"
              :class="{ selected: selectedSize === size.name }"
              :disabled="size.stock === 0"
              :aria-pressed="selectedSize === size.name"
              :aria-label="size.name + (size.stock === 0 ? t(' — unavailable', ' — غير متاح') : '')"
              @click="selectSize(size.name)"
            >
              {{ size.name }}
            </button>
          </div>
          <div
            v-if="hasSizePriceRange(product)"
            class="size-price-guide"
            :aria-label="t('Price by size', 'السعر حسب المقاس')"
          >
            <span
              v-for="size in product.sizes.filter((option) => option.stock > 0)"
              :key="size.name"
            >
              {{ size.name }} · {{ money(sizePrice(product, size.name)) }}
            </span>
          </div>
          <p class="size-hint">
            {{
              selectedSize
                ? t('Selected size is available.', 'المقاس المختار متاح.')
                : t(
                    'Choose a size to add this piece to your bag.',
                    'اختار مقاس عشان تضيف القطعة للسلة.',
                  )
            }}
          </p>
          <p
            v-if="product.modelMeasurements?.en && product.modelMeasurements?.ar"
            class="product-size-help"
          >
            <strong>{{ t('Model measurements', 'قياسات الموديل') }}:</strong>
            {{ localized(product.modelMeasurements) }}
          </p>
        </div>
        <div ref="buyElement" class="product-actions">
          <button
            class="button button-dark add-button"
            :disabled="buying"
            @click="selectedSize ? addToBag(true) : promptSize()"
          >
            {{
              buying
                ? t('Adding…', 'جارٍ الإضافة…')
                : selectedSize
                  ? t('Buy now', 'اشتري الآن')
                  : t('Choose a size', 'اختار المقاس')
            }}<KhtIcon name="arrow" />
          </button>
          <button
            class="button button-outline add-button"
            :disabled="!selectedSize || buying"
            @click="addToBag(false)"
          >
            {{ t('Add to bag', 'أضف للسلة') }}
          </button>
        </div>
        <div class="product-purchase-facts">
          <p>
            <strong>{{ t('Final product price', 'السعر النهائي للمنتج') }}</strong>
            <span>{{ money(displayedPrice) }}</span>
          </p>
          <p v-if="fabricDescription">
            <strong>{{ t('Fabric', 'الخامة') }}</strong> <span>{{ fabricDescription }}</span>
          </p>
          <p v-if="gsm">
            <strong>GSM</strong><span>{{ gsm }}</span>
          </p>
          <p>
            <strong>{{ t('Sizes', 'المقاسات') }}</strong>
            <span>{{ product.sizes.map((size) => size.name).join(' / ') }}</span>
          </p>
          <p v-if="product.modelMeasurements?.en && product.modelMeasurements?.ar">
            <strong>{{ t('Model height, weight & size', 'طول ووزن ومقاس الموديل') }}</strong>
            <span>{{ localized(product.modelMeasurements) }}</span>
          </p>
          <p>
            <strong>{{ t('Payment', 'الدفع') }}</strong>
            <span>{{ t('Cash on delivery', 'الدفع عند الاستلام') }}</span>
          </p>
          <p>
            <strong>{{ t('Delivery time', 'مدة الشحن') }}</strong>
            <span>{{
              t('Confirmed by the courier for your area', 'تؤكدها شركة الشحن حسب منطقتك')
            }}</span>
          </p>
          <p>
            <strong>{{ localized(policy.productReturnTabLabel) }}</strong>
            <span>{{ localized(policy.productReturnSummary) }}</span>
          </p>
        </div>
        <a
          class="product-whatsapp-link"
          :href="productWhatsApp"
          target="_blank"
          rel="noopener noreferrer"
          >{{ t('Ask about this size on WhatsApp', 'اسأل عن المقاس ده على واتساب') }} ↗</a
        >
        <a v-if="featuredReview" class="product-featured-review" href="#product-reviews">
          <span aria-hidden="true">★★★★★</span>
          <q>{{ featuredReview.body }}</q>
          <small>{{ featuredReview.displayName }} · {{ t('Verified buyer', 'مشتري موثّق') }}</small>
        </a>
        <a v-else class="product-review-empty-link" href="#product-reviews">{{
          t(
            'No verified reviews yet. See customer reviews',
            'لا توجد تقييمات موثقة بعد. شوف آراء العملاء',
          )
        }}</a>
        <p v-if="message" class="form-error" role="alert">{{ message }}</p>
        <ul class="product-trust">
          <li>{{ t('Cash on delivery', 'الدفع عند الاستلام') }}</li>
          <li>
            {{ localized(policy.productInspectionMessage) }}
          </li>
          <li>{{ localized(policy.productReturnMessage) }}</li>
          <li>
            {{
              t(
                'Delivery charge shown before order confirmation',
                'مصاريف الشحن بتظهر قبل تأكيد الطلب',
              )
            }}
          </li>
        </ul>
        <dl
          v-if="product.fabric?.en || product.stitching?.en || product.embroidery?.en"
          class="product-proof"
        >
          <template v-if="product.fabric?.en && product.fabric?.ar">
            <dt>{{ t('Fabric', 'القماش') }}</dt>
            <dd>{{ localized(product.fabric) }}</dd>
          </template>
          <template v-if="product.stitching?.en && product.stitching?.ar">
            <dt>{{ t('Stitching', 'الخياطة') }}</dt>
            <dd>{{ localized(product.stitching) }}</dd>
          </template>
          <template v-if="product.embroidery?.en && product.embroidery?.ar">
            <dt>{{ t('Embroidery', 'التطريز') }}</dt>
            <dd>{{ localized(product.embroidery) }}</dd>
          </template>
        </dl>
        <div class="product-service-links">
          <NuxtLink to="/shipping">{{ t('Delivery information', 'معلومات التوصيل') }}</NuxtLink
          ><NuxtLink to="/returns">{{ localized(policy.productReturnLinkLabel) }}</NuxtLink>
        </div>
        <div class="product-info-tabs">
          <div role="tablist" :aria-label="t('Product information', 'معلومات المنتج')">
            <button
              v-for="tab in ['fit', 'care', 'delivery', 'returns'] as const"
              :id="`product-tab-${tab}`"
              :key="tab"
              type="button"
              role="tab"
              :aria-controls="`product-panel-${tab}`"
              :aria-selected="activeInfoTab === tab"
              :tabindex="activeInfoTab === tab ? 0 : -1"
              @click="activeInfoTab = tab"
              @keydown="moveInfoTab"
            >
              {{
                tab === 'fit'
                  ? t('Fit', 'القَصّة')
                  : tab === 'care'
                    ? t('Details & care', 'التفاصيل والعناية')
                    : tab === 'delivery'
                      ? t('Delivery', 'التوصيل')
                      : localized(policy.productReturnTabLabel)
              }}
            </button>
          </div>
          <div
            v-for="tab in ['fit', 'care', 'delivery', 'returns'] as const"
            v-show="activeInfoTab === tab"
            :id="`product-panel-${tab}`"
            :key="tab"
            role="tabpanel"
            :aria-labelledby="`product-tab-${tab}`"
            tabindex="0"
          >
            <p v-if="tab === 'fit'">{{ localized(product.fit) }}</p>
            <p v-else-if="tab === 'care'">{{ localized(product.detail) }}</p>
            <p v-else-if="tab === 'delivery'">
              {{
                t(
                  'Delivery charge is shown before order confirmation.',
                  'مصاريف الشحن بتظهر قبل تأكيد الطلب.',
                )
              }}
              <NuxtLink to="/shipping">{{ t('Delivery information', 'معلومات التوصيل') }}</NuxtLink>
            </p>
            <p v-else>
              {{ localized(policy.productReturnSummary) }}
              <NuxtLink to="/returns">{{ localized(policy.productReadPolicyLabel) }}</NuxtLink>
            </p>
          </div>
        </div>
        <details class="detail-accordion" open>
          <summary>{{ t('The fit', 'القَصّة') }}<span>+</span></summary>
          <p>{{ localized(product.fit) }}</p>
        </details>
        <details class="detail-accordion">
          <summary>{{ t('Details & care', 'التفاصيل والعناية') }}<span>+</span></summary>
          <p>{{ localized(product.detail) }}</p>
        </details>
        <details class="detail-accordion">
          <summary>{{ t('Delivery', 'التوصيل') }}<span>+</span></summary>
          <p>
            {{
              t(
                'Delivery charge is shown before order confirmation.',
                'مصاريف الشحن بتظهر قبل تأكيد الطلب.',
              )
            }}
            <NuxtLink to="/shipping">{{ t('Delivery information', 'معلومات التوصيل') }}</NuxtLink>
          </p>
        </details>
        <details class="detail-accordion">
          <summary>{{ localized(policy.productReturnTabLabel) }}<span>+</span></summary>
          <p>
            {{ localized(policy.productReturnSummary) }}
            <NuxtLink to="/returns">{{ localized(policy.productReadPolicyLabel) }}</NuxtLink>
          </p>
        </details>
        <p class="product-demo-note">
          {{
            t(
              'Price and stock are confirmed when you place your cash on delivery order.',
              'السعر والمخزون بيتأكدوا وقت تسجيل طلب الدفع عند الاستلام.',
            )
          }}
        </p>
      </div>
    </div>
    <section class="product-worth" aria-labelledby="product-worth-title">
      <p class="eyebrow">KHT / THE DETAILS</p>
      <h2 id="product-worth-title">
        {{ t('Why is KHT worth its price?', 'لماذا يستحق KHT سعره؟') }}
      </h2>
      <div class="product-worth__grid">
        <article>
          <h3>{{ t('The fit', 'القَصّة') }}</h3>
          <p>{{ localized(product.fit) }}</p>
        </article>
        <article v-if="fabricDescription">
          <h3>{{ t('The fabric', 'الخامة') }}</h3>
          <p>{{ fabricDescription }}</p>
        </article>
        <article v-if="productHighlights.length">
          <h3>{{ t('The details', 'التفاصيل') }}</h3>
          <ul>
            <li v-for="point in productHighlights.slice(0, 4)" :key="point">{{ point }}</li>
          </ul>
        </article>
        <article v-if="setSaving">
          <h3>{{ t('The full set', 'الطقم الكامل') }}</h3>
          <p>
            {{
              t(
                `Save around ${setSaving}% compared with buying the pieces separately.`,
                `وفّر حوالي ${setSaving}٪ مقارنة بشراء القطع منفصلة.`,
              )
            }}
          </p>
        </article>
      </div>
    </section>
    <section id="product-reviews" class="product-reviews" aria-labelledby="product-reviews-title">
      <div class="product-reviews__heading">
        <div>
          <p class="eyebrow">KHT / {{ t('CUSTOMER VOICE', 'آراء العملاء') }}</p>
          <h2 id="product-reviews-title">{{ t('WORN. LOVED. SHARED.', 'من تجربة عملائنا.') }}</h2>
          <p v-if="reviewCount" class="product-reviews__score">
            <span aria-hidden="true">★</span> {{ reviewAverage.toFixed(1) }} / 5 · {{ reviewCount }}
            {{ t('verified reviews', 'آراء مشترين') }}
          </p>
          <p v-else class="product-reviews__empty">
            {{
              t(
                'No reviews published yet. Be the first buyer to share your experience after delivery.',
                'مافيش آراء منشورة للمنتج لسه. بعد الاستلام تقدر تكون أول واحد يشارك تجربته.',
              )
            }}
          </p>
        </div>
        <button
          type="button"
          class="button button-outline"
          :aria-expanded="reviewOpen"
          @click="reviewOpen = !reviewOpen"
        >
          {{ t('Write a review', 'اكتب رأيك') }}
        </button>
      </div>
      <p v-if="reviewSuccess" role="status" class="product-reviews__success">{{ reviewSuccess }}</p>
      <form v-if="reviewOpen" class="product-review-form" @submit.prevent="submitReview">
        <p>
          {{
            t(
              'For customers whose order has been delivered. Your display name and review will be public after approval; your phone and order number stay private.',
              'لمن استلموا طلبهم. اسم العرض والرأي هيظهروا بعد المراجعة، ورقم الموبايل والطلب هيفضلوا خاصين.',
            )
          }}
        </p>
        <div class="product-review-form__grid">
          <label
            >{{ t('Order number', 'رقم الطلب')
            }}<input v-model.trim="reviewForm.reference" required maxlength="80" autocomplete="off"
          /></label>
          <label
            >{{ t('Order phone', 'موبايل الطلب')
            }}<input
              v-model.trim="reviewForm.phone"
              required
              type="tel"
              inputmode="tel"
              autocomplete="tel"
          /></label>
          <label
            >{{ t('Name to display', 'الاسم اللي هيظهر')
            }}<input
              v-model.trim="reviewForm.displayName"
              required
              minlength="2"
              maxlength="50"
              autocomplete="nickname"
          /></label>
          <label
            >{{ t('Rating', 'التقييم')
            }}<select v-model.number="reviewForm.rating" required>
              <option v-for="rating in [5, 4, 3, 2, 1]" :key="rating" :value="rating">
                {{ rating }} / 5
              </option>
            </select></label
          >
        </div>
        <label
          >{{ t('Your experience', 'رأيك في المنتج')
          }}<textarea
            v-model.trim="reviewForm.body"
            required
            minlength="12"
            maxlength="1000"
            rows="4"
          />
        </label>
        <p v-if="reviewError" role="alert" class="form-error">{{ reviewError }}</p>
        <button type="submit" class="button button-dark" :disabled="reviewBusy">
          {{ reviewBusy ? t('Sending…', 'جارٍ الإرسال…') : t('Send review', 'إرسال الرأي') }}
        </button>
      </form>
      <div v-if="reviewData?.reviews.length" class="product-review-list">
        <article v-for="review in reviewData.reviews" :key="review.id" class="product-review-card">
          <p
            class="review-stars"
            :aria-label="`${review.rating} ${t('out of 5 stars', 'من ٥ نجوم')}`"
          >
            {{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}
          </p>
          <p>{{ review.body }}</p>
          <div>
            <strong>{{ review.displayName }}</strong
            ><span>{{ t('Verified purchase', 'شراء موثّق') }}</span>
          </div>
        </article>
      </div>
    </section>
    <section class="related-section">
      <div class="section-heading">
        <h2>{{ t('SAME LINE. NEW FORM.', 'نفس الخط. شكل جديد.') }}</h2>
        <NuxtLink to="/shop" class="text-link"
          >{{ t('All pieces', 'كل القطع') }}<KhtIcon name="arrow"
        /></NuxtLink>
      </div>
      <div class="product-grid related-grid">
        <ProductCard
          v-for="item in catalog.products.filter((p) => p.id !== product!.id)"
          :key="item.id"
          :product="item"
        />
      </div>
    </section>
    <div v-if="stickyVisible" class="mobile-buy-bar">
      <div>
        <ProductPrice
          :price="displayedPrice"
          :compare-at-price="product.compareAtPrice"
          :from="priceStartsAt"
          compact
        />
        <WelcomePriceHint
          :price="displayedPrice"
          :product-slug="product.slug"
          compact
          :link="false"
        />
        <small>{{
          selectedSize
            ? `${t('Size', 'المقاس')}: ${selectedSize}`
            : t('Select size', 'اختار المقاس')
        }}</small>
      </div>
      <button
        class="button button-dark"
        :disabled="buying"
        @click="selectedSize ? addToBag(true) : promptSize()"
      >
        {{ selectedSize ? t('Buy now', 'اشتري الآن') : t('Select size', 'اختار مقاسك')
        }}<KhtIcon name="arrow" />
      </button>
    </div>
    <OverlayPanel
      :open="sizeGuide"
      :title="t('Finding your fit', 'اختار المقاس المناسب')"
      @close="sizeGuide = false"
      ><SizeGuideContent
    /></OverlayPanel>
    <SizeFinder
      v-if="showSizeFinder"
      :open="sizeFinderOpen"
      :available-sizes="finderAvailableSizes"
      :assistance-url="sizingAssistanceUrl"
      @close="sizeFinderOpen = false"
      @select="applyFinderSize"
      @guide="showSizeGuideFromFinder"
    />
    <OverlayPanel :open="zoom" :title="localized(product.name)" wide @close="zoom = false"
      ><div class="zoom-toolbar">
        <p>{{ t('Scroll to explore the details.', 'مرّر الصورة لاستكشاف التفاصيل.') }}</p>
        <button class="remove-link" :aria-pressed="!actualSize" @click="actualSize = !actualSize">
          {{ actualSize ? t('Fit image', 'اعرض الصورة كاملة') : t('Actual size', 'الحجم الأصلي') }}
        </button>
      </div>
      <div
        class="zoom-viewport"
        :class="{ 'zoom-fit': !actualSize }"
        tabindex="0"
        role="region"
        :aria-label="t('Product image, scroll to explore', 'صورة المنتج، مرّر لاستكشافها')"
      >
        <StoreImage
          :src="selectedImage"
          sizes="1086px"
          :alt="`${localized(product.name)} — ${t('image', 'صورة')} ${selectedImageIndex + 1}`"
          class="zoomed-product"
          width="1086"
          height="1448"
        />
      </div>
      <p class="muted">
        {{ t('Product garment. Front view.', 'القطعة من الأمام.') }}
      </p></OverlayPanel
    >
  </main>
</template>
