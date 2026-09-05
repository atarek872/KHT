<script setup lang="ts">
import { useStoreContact } from '../../shared/storeConfig'

const { t, localized } = useLanguage()
const route = useRoute()
const contact = useStoreContact()
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
        heading: { en: 'Delivery and cash on delivery', ar: 'التوصيل والدفع عند الاستلام' },
        body: {
          en: 'Available governorates and the delivery charge are shown before you place the order. Orders use cash on delivery. The courier will contact you to coordinate delivery, and you must provide a reachable phone number and accurate address.',
          ar: 'المحافظات المتاحة وتكلفة الشحن بيظهروا قبل تسجيل الطلب. الدفع عند الاستلام فقط، وشركة الشحن هتتواصل معاك لتنسيق الموعد؛ لذلك لازم تكتب رقم موبايل متاح وعنوان دقيق.',
        },
      },
      {
        heading: { en: 'Inspection at delivery', ar: 'فحص الطلب عند الاستلام' },
        body: {
          en: 'You may request inspection at delivery before accepting the parcel. If the item is wrong, damaged, or materially different from the confirmed order, refuse it and contact KHT. If you refuse a correct order or cannot be reached, the delivery charge remains payable.',
          ar: 'من حقك تطلب فحص الطلب عند الاستلام قبل قبول الشحنة. لو القطعة غلط أو تالفة أو مختلفة بشكل واضح عن الطلب المؤكد، ارفضها وتواصل مع KHT. لو رفضت طلب صحيح أو تعذر الوصول ليك، بتتحمل تكلفة الشحن.',
        },
      },
      {
        heading: { en: 'Returns & exchanges', ar: 'الاستبدال والاسترجاع' },
        body: {
          en: 'Request an exchange within three calendar days of delivery. Items must be unused, unwashed, unaltered, and returned with all tags and original packaging. The customer pays both exchange delivery trips unless KHT sent a wrong or defective item. Custom-made or altered items are not eligible unless defective.',
          ar: 'اطلب الاستبدال خلال ثلاثة أيام تقويمية من الاستلام. لازم القطعة تكون غير مستخدمة وغير مغسولة أو معدلة، وبكل التيكتات والتغليف الأصلي. العميل بيتحمل مصاريف شحنتي الاستبدال إلا لو KHT بعتت قطعة غلط أو فيها عيب. الطلبات المصنوعة أو المعدلة خصيصًا لا تُستبدل إلا في حالة وجود عيب.',
        },
      },
      {
        heading: { en: 'Refund handling', ar: 'طريقة رد المبلغ' },
        body: {
          en: 'Approved refunds for cash on delivery orders are arranged through the official customer-care channel after the returned item is received and inspected. Delivery charges are not refundable unless the issue was caused by KHT.',
          ar: 'رد قيمة طلبات الدفع عند الاستلام المقبولة بيتم ترتيبه من خلال وسيلة خدمة العملاء الرسمية بعد استلام القطعة وفحصها. مصاريف الشحن لا تُرد إلا لو المشكلة بسبب KHT.',
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
          en: 'Use the official channels shown on this page for order, exchange, or privacy support. Keep your order reference so we can help you quickly.',
          ar: 'استخدم بيانات التواصل الرسمية الظاهرة في الصفحة بخصوص الطلبات أو الاستبدال أو الخصوصية. احتفظ برقم الطلب علشان نقدر نساعدك بسرعة.',
        },
      },
      {
        heading: { en: 'Explore in the meantime', ar: 'اكتشف المجموعة' },
        body: {
          en: 'For order support, include your order reference and the phone number used at checkout. Never send passwords or payment-card details; KHT currently accepts cash on delivery only.',
          ar: 'للدعم الخاص بالطلبات، ابعت رقم الطلب ورقم الموبايل المستخدم وقت الشراء. ما تبعتش كلمات سر أو بيانات كروت؛ KHT بيقبل الدفع عند الاستلام فقط حاليًا.',
        },
      },
    ],
  },
  privacy: {
    title: { en: 'YOUR PRIVACY.', ar: 'خصوصيتك.' },
    sections: [
      {
        heading: { en: 'What we collect', ar: 'البيانات اللي بنجمعها' },
        body: {
          en: 'KHT stores your language choice and cart contents in browser cookies. When you enter a valid phone number or email at checkout, we may save your name, contact details, and cart contents so customer care can identify an abandoned cart. Placing an order also stores the delivery address, order lines, totals, status, and support history.',
          ar: 'KHT بيحفظ اختيار اللغة ومحتويات السلة في ملفات تعريف الارتباط. لما تدخل رقم موبايل أو بريد صحيح في إتمام الطلب، ممكن نحفظ الاسم وبيانات التواصل ومحتويات السلة علشان خدمة العملاء تقدر تحدد السلة المتروكة. تسجيل الطلب بيحفظ كمان عنوان التوصيل والقطع والإجماليات والحالة وسجل الدعم.',
        },
      },
      {
        heading: { en: 'How data is used and stored', ar: 'استخدام البيانات وتخزينها' },
        body: {
          en: 'We use this data to validate stock, fulfil and track orders, prevent abuse, answer support requests, and manually follow up on contactable abandoned carts. Commerce records are stored in Cloudflare D1 and product media in Cloudflare R2. KHT does not collect card data or run automated marketing from this store.',
          ar: 'بنستخدم البيانات للتأكد من المخزون وتنفيذ ومتابعة الطلبات ومنع إساءة الاستخدام والرد على الدعم والمتابعة اليدوية للسلات المتروكة القابلة للتواصل. سجلات المتجر محفوظة في Cloudflare D1 وصور المنتجات في Cloudflare R2. KHT لا يجمع بيانات كروت ولا يشغّل تسويق آلي من المتجر.',
        },
      },
      {
        heading: { en: 'Retention and your choices', ar: 'مدة الاحتفاظ وحقوقك' },
        body: {
          en: 'We keep order and support records only as long as needed for fulfilment, disputes, fraud prevention, and legal or accounting duties. You may ask customer care to access, correct, or delete eligible personal data. Some order records may need to be retained where the law requires it.',
          ar: 'بنحتفظ بسجلات الطلب والدعم للمدة اللازمة للتنفيذ وحل النزاعات ومنع الاحتيال والالتزامات القانونية أو المحاسبية. تقدر تطلب من خدمة العملاء الوصول لبياناتك أو تصحيحها أو حذف البيانات المؤهلة، مع الاحتفاظ ببعض سجلات الطلب لو القانون بيطلب ده.',
        },
      },
    ],
  },
  terms: {
    title: { en: 'THE DETAILS.', ar: 'التفاصيل.' },
    sections: [
      {
        heading: { en: 'Ordering and payment', ar: 'الطلب والدفع' },
        body: {
          en: 'Submitting checkout creates a cash on delivery order using the items, address, and phone number you provide. Prices, discounts, delivery, and stock are recalculated by KHT when the order is placed. An order reference confirms receipt, not guaranteed fulfilment; KHT may contact you to confirm or cancel unavailable or suspicious orders.',
          ar: 'إرسال بيانات إتمام الطلب بينشئ طلب دفع عند الاستلام بالقطع والعنوان ورقم الموبايل اللي قدمتهم. KHT بيعيد حساب الأسعار والخصومات والشحن والمخزون وقت تسجيل الطلب. رقم الطلب يؤكد استلامه لكنه مش ضمان للتنفيذ؛ ممكن KHT يتواصل معاك للتأكيد أو يلغي الطلب غير المتاح أو المشتبه فيه.',
        },
      },
      {
        heading: { en: 'Accuracy and availability', ar: 'دقة البيانات والتوفر' },
        body: {
          en: 'You are responsible for accurate contact and delivery details and for being available to receive the parcel. Product colour can vary slightly by screen. If a pricing, stock, or description error affects an order, KHT will contact you before fulfilment and may correct or cancel it.',
          ar: 'أنت مسؤول عن صحة بيانات التواصل والتوصيل والتواجد لاستلام الشحنة. لون المنتج ممكن يختلف بدرجة بسيطة حسب الشاشة. لو فيه خطأ في السعر أو المخزون أو الوصف مؤثر على الطلب، KHT هيتواصل معاك قبل التنفيذ وممكن يصححه أو يلغيه.',
        },
      },
      {
        heading: { en: 'Cancellations and acceptable use', ar: 'الإلغاء والاستخدام المقبول' },
        body: {
          en: 'Ask customer care to cancel before the order is shipped. Repeated false orders, abusive activity, automated requests, or attempts to interfere with the store may be rejected. Shipping, exchange, privacy, and any product-specific conditions form part of these terms.',
          ar: 'اطلب الإلغاء من خدمة العملاء قبل شحن الطلب. الطلبات الوهمية المتكررة أو الإساءة أو الطلبات الآلية أو محاولة تعطيل المتجر ممكن يتم رفضها. شروط الشحن والاستبدال والخصوصية وأي شروط خاصة بالمنتج جزء من الشروط دي.',
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
          en: 'Yes. Add available items to your bag, enter accurate delivery details, and place a cash on delivery order. Keep the reference shown after checkout.',
          ar: 'أيوه. ضيف القطع المتاحة للسلة، واكتب بيانات توصيل صحيحة، وسجّل طلب دفع عند الاستلام. احتفظ برقم الطلب اللي هيظهر بعد الإتمام.',
        },
      },
      {
        heading: { en: 'How does the tracksuit fit?', ar: 'مقاس السوت إزاي؟' },
        body: {
          en: 'A tracksuit uses the same selected size for the jacket and trousers unless its product page says otherwise. Check the size guide before ordering.',
          ar: 'السوت بيستخدم نفس المقاس المختار للجاكيت والبنطلون إلا لو صفحة المنتج قالت غير كده. راجع دليل المقاسات قبل الطلب.',
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
      <section v-if="String(route.params.info) === 'contact' && contact.configured">
        <h2>{{ t('Official channels', 'وسائل التواصل الرسمية') }}</h2>
        <p v-if="contact.email">
          <a :href="contact.emailHref">{{ contact.email }}</a>
        </p>
        <p v-if="contact.phone">
          <a :href="contact.phoneHref" dir="ltr">{{ contact.phone }}</a>
        </p>
        <p v-if="contact.whatsapp">
          <a :href="contact.whatsappHref" target="_blank" rel="noopener noreferrer" dir="ltr">
            WhatsApp · {{ contact.whatsapp }}
          </a>
        </p>
      </section>
      <section v-else-if="String(route.params.info) === 'contact'">
        <h2>{{ t('Official channels', 'وسائل التواصل الرسمية') }}</h2>
        <p>
          {{
            t(
              'Customer-care details are being prepared. Please check this page again before placing a public order.',
              'بيانات خدمة العملاء جاري تجهيزها. راجع الصفحة دي قبل تسجيل طلب عام.',
            )
          }}
        </p>
      </section>
      <NuxtLink to="/shop" class="text-link"
        >{{ t('Explore the collection', 'اكتشف المجموعة') }}<KhtIcon name="arrow"
      /></NuxtLink>
    </div>
  </main>
</template>
