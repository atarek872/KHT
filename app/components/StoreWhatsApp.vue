<script setup lang="ts">
import { khtWhatsAppLink } from '#shared/whatsapp'

const route = useRoute()
const catalog = useCatalog()
const { t, localized } = useLanguage()
const selectedSize = useState('kht-whatsapp-product-size', () => '')
const product = computed(() =>
  route.path.startsWith('/products/')
    ? catalog.value.products.find((item) => item.slug === route.params.slug)
    : undefined,
)
const href = computed(() =>
  khtWhatsAppLink(
    product.value
      ? t(
          `Hello KHT, I have a question about ${localized(product.value.name)}. Size: ${selectedSize.value || 'not selected yet'}.`,
          `أهلاً KHT، عندي استفسار عن ${localized(product.value.name)}. المقاس: ${selectedSize.value || 'لسه ما اخترتش'}.`,
        )
      : t('Hello KHT, I need help with an order.', 'أهلاً KHT، محتاج مساعدة في طلب.'),
  ),
)
</script>

<template>
  <a
    class="store-whatsapp"
    :class="{ 'store-whatsapp--product': product }"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="t('Ask KHT on WhatsApp', 'اسأل KHT على واتساب')"
  >
    <span aria-hidden="true">↗</span><span>WhatsApp</span>
  </a>
</template>
