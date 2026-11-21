<script setup lang="ts">
import { khtWhatsAppLink } from '#shared/whatsapp'

const props = defineProps<{
  reference: string
  status: string
  items: { productName: string; variant: string; quantity: number }[]
}>()
const { t } = useLanguage()
const itemSummary = computed(() =>
  props.items.map((item) => `${item.productName} · ${item.variant} × ${item.quantity}`).join('، '),
)
const canConfirm = computed(() => props.status === 'pending')
const canCancel = computed(() => ['pending', 'confirmed', 'processing'].includes(props.status))
const canChangeSize = computed(() => !['cancelled', 'returned', 'delivered'].includes(props.status))
const confirmUrl = computed(() =>
  khtWhatsAppLink(
    t(
      `Hello KHT, please confirm my order ${props.reference}.`,
      `أهلاً KHT، عايز أأكد طلبي رقم ${props.reference}.`,
    ),
  ),
)
const sizeUrl = computed(() =>
  khtWhatsAppLink(
    t(
      `Hello KHT, I would like to ask about changing a size in order ${props.reference}. Items: ${itemSummary.value}. Please contact me before changing anything.`,
      `أهلاً KHT، عايز أستفسر عن تغيير مقاس في الطلب ${props.reference}. القطع: ${itemSummary.value}. ياريت تتواصلوا معايا قبل أي تعديل.`,
    ),
  ),
)
const cancelUrl = computed(() =>
  khtWhatsAppLink(
    t(
      `Hello KHT, I would like to request cancellation of order ${props.reference}. Please confirm the request.`,
      `أهلاً KHT، عايز أطلب إلغاء الأوردر ${props.reference}. ياريت تأكدوا لي الطلب.`,
    ),
  ),
)
</script>

<template>
  <section
    v-if="canConfirm || canChangeSize || canCancel"
    class="order-whatsapp-actions"
    :aria-label="t('WhatsApp order help', 'مساعدة الطلب على واتساب')"
  >
    <h2>{{ t('Need to update your order?', 'محتاج تعدّل طلبك؟') }}</h2>
    <div>
      <a v-if="canConfirm" :href="confirmUrl" target="_blank" rel="noopener noreferrer">
        {{ t('Message to confirm', 'راسلنا لتأكيد الطلب') }} ↗</a
      >
      <a v-if="canChangeSize" :href="sizeUrl" target="_blank" rel="noopener noreferrer">
        {{ t('Ask to change size', 'اطلب تعديل المقاس') }} ↗</a
      >
      <a v-if="canCancel" :href="cancelUrl" target="_blank" rel="noopener noreferrer">
        {{ t('Request cancellation', 'اطلب الإلغاء') }} ↗</a
      >
    </div>
    <p>
      {{
        t(
          'Messages open WhatsApp. Changes take effect only after KHT confirms them.',
          'الرسائل بتفتح واتساب. أي تعديل بيتم فقط بعد ما KHT يأكده لك.',
        )
      }}
    </p>
  </section>
</template>
