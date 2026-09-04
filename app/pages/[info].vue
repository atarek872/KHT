<script setup lang="ts">
const { t, localized } = useLanguage()
const route = useRoute()
const pages: Record<
  string,
  {
    title: { en: string; ar: string }
    sections: { heading: { en: string; ar: string }; body: { en: string; ar: string } }[]
  }
> = {
  shipping: {
    title: { en: 'SHIPPING & RETURNS.', ar: 'الشحن والاسترجاع.' },
    sections: [
      {
        heading: { en: 'Before we launch', ar: 'قبل الإطلاق' },
        body: {
          en: 'This storefront is a concept preview. Products, prices and the delivery charge shown at checkout are illustrative. We are not accepting or shipping commercial orders yet.',
          ar: 'المتجر نسخة تصورية. المنتجات والأسعار وتكلفة التوصيل في إتمام الطلب توضيحية. لا نستقبل أو نشحن طلبات تجارية حاليًا.',
        },
      },
      {
        heading: { en: 'Delivery information', ar: 'معلومات التوصيل' },
        body: {
          en: 'Delivery regions, rates and expected arrival times will be published before real checkout is enabled. The final charge will always appear before you confirm an order.',
          ar: 'مناطق التوصيل والتكلفة والمدد المتوقعة تُنشر قبل تفعيل الشراء الحقيقي. التكلفة النهائية تظهر قبل تأكيد الطلب.',
        },
      },
      {
        heading: { en: 'Returns & exchanges', ar: 'الاستبدال والاسترجاع' },
        body: {
          en: 'The return window, item conditions, fees and contact channel will be published with the launch collection. No return policy has been finalized for this preview.',
          ar: 'مدة الاسترجاع وشروط حالة القطعة والتكلفة وطريقة التواصل تُنشر مع مجموعة الإطلاق. سياسة الاسترجاع غير معتمدة بعد للنسخة التصورية.',
        },
      },
    ],
  },
  contact: {
    title: { en: 'LET’S CONNECT.', ar: 'نتواصل.' },
    sections: [
      {
        heading: { en: 'KHT customer care', ar: 'خدمة عملاء KHT' },
        body: {
          en: 'Our customer care email, phone number and official social accounts will be added before launch. This concept preview does not send messages or accept support requests.',
          ar: 'بريد خدمة العملاء والهاتف والحسابات الرسمية تُضاف قبل الإطلاق. النسخة التصورية لا ترسل رسائل أو تستقبل طلبات دعم.',
        },
      },
      {
        heading: { en: 'Explore in the meantime', ar: 'اكتشف المجموعة' },
        body: {
          en: 'You can explore the collection, check the sample size guide and try the checkout with example details.',
          ar: 'تقدر تتصفح المجموعة وتشوف مثال دليل المقاسات وتجرب إتمام الطلب ببيانات المثال.',
        },
      },
    ],
  },
  privacy: {
    title: { en: 'YOUR PRIVACY.', ar: 'خصوصيتك.' },
    sections: [
      {
        heading: { en: 'This preview', ar: 'النسخة التصورية' },
        body: {
          en: 'Your language choice and bag selections are stored in browser cookies. The checkout demo sends product selections for price validation, but does not submit your contact or address fields. Your order preview is stored only in this browser tab’s session storage.',
          ar: 'اختيار اللغة ومحتويات السلة محفوظة في ملفات تعريف الارتباط. تجربة إتمام الطلب ترسل اختيارات المنتجات للتحقق من السعر، ولا ترسل حقول التواصل أو العنوان. معاينة الطلب محفوظة في تخزين الجلسة لعلامة التبويب فقط.',
        },
      },
      {
        heading: { en: 'Before commercial launch', ar: 'قبل الإطلاق التجاري' },
        body: {
          en: 'A complete privacy notice identifying the store operator, service providers, retention periods and contact details must be published before real customer orders are accepted. This page describes preview behavior only.',
          ar: 'تُعتمد سياسة كاملة تشمل مشغل المتجر ومقدمي الخدمة ومدد الاحتفاظ بالبيانات ووسائل التواصل قبل استقبال طلبات حقيقية. الصفحة تصف سلوك النسخة التصورية فقط.',
        },
      },
    ],
  },
  terms: {
    title: { en: 'THE DETAILS.', ar: 'التفاصيل.' },
    sections: [
      {
        heading: { en: 'Concept storefront', ar: 'متجر تصوري' },
        body: {
          en: 'The products, imagery, sizing and prices in this preview are concepts, not an offer to sell. The checkout creates a local demo summary, not a commercial order. No payment is requested or collected.',
          ar: 'المنتجات والصور والمقاسات والأسعار تصورية وليست عرض بيع. إتمام الطلب ينشئ ملخص تجربة محليًا، وليس طلبًا تجاريًا. لا يتم طلب أو تحصيل دفعة.',
        },
      },
      {
        heading: { en: 'Production terms', ar: 'شروط النسخة النهائية' },
        body: {
          en: 'Store details and final purchase, payment, shipping and return terms will be published before the store accepts real orders.',
          ar: 'تُعتمد بيانات المتجر وشروط الشراء والدفع والشحن والاسترجاع قبل قبول طلبات حقيقية.',
        },
      },
    ],
  },
  faq: {
    title: { en: 'A FEW ANSWERS.', ar: 'إجابات تهمك.' },
    sections: [
      {
        heading: { en: 'Can I order now?', ar: 'أقدر أطلب دلوقتي؟' },
        body: {
          en: 'You can try the complete demo journey. Real ordering and payments are not enabled.',
          ar: 'تقدر تجرب رحلة الطلب كاملة. الشراء والدفع الحقيقي غير مفعّلين.',
        },
      },
      {
        heading: { en: 'How does the tracksuit fit?', ar: 'مقاس السوت إزاي؟' },
        body: {
          en: 'The concept tracksuit uses the same selected size for the jacket and trousers. See the size guide for illustrative measurements.',
          ar: 'السوت التصوري يستخدم نفس المقاس للجاكيت والبنطلون. راجع دليل المقاسات للقياسات التوضيحية.',
        },
      },
    ],
  },
}
const page = computed(
  () => pages[String(route.params.info) === 'returns' ? 'shipping' : String(route.params.info)],
)
if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Page not found' })
useSeoMeta({ title: () => `${page.value ? localized(page.value.title) : 'Page'} — KHT` })
</script>
<template>
  <main v-if="page" id="main" class="info-page light-surface">
    <p class="eyebrow">KHT / {{ t('CUSTOMER CARE', 'المساعدة') }}</p>
    <h1>{{ localized(page.title) }}</h1>
    <div class="info-body">
      <section v-for="(section, i) in page.sections" :key="i">
        <h2>{{ localized(section.heading) }}</h2>
        <p>{{ localized(section.body) }}</p>
      </section>
      <NuxtLink to="/shop" class="text-link"
        >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </main>
</template>
