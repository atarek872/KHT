<script setup lang="ts">
import { useStoreContact } from '#shared/storeConfig'

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
          en: 'You may request inspection at delivery where the courier permits it. If the item is wrong, damaged, or materially different from the confirmed order, refuse it and contact KHT through the official customer-care channel. This inspection option does not limit your statutory return rights.',
          ar: 'تقدر تطلب فحص الطلب عند الاستلام إذا كانت شركة الشحن تسمح بذلك. لو القطعة غلط أو تالفة أو مختلفة بشكل واضح عن الطلب المؤكد، ارفضها وتواصل مع KHT من خلال خدمة العملاء الرسمية. إمكانية الفحص لا تقلل من حقوقك القانونية في الاستبدال أو الاسترجاع.',
        },
      },
      {
        heading: { en: '14-day returns', ar: 'الاستبدال والاسترجاع خلال 14 يوم' },
        body: {
          en: 'Under Egyptian Consumer Protection Law, you may exchange or return an eligible item within 14 calendar days of receiving it, without giving a reason or bearing return costs. The item must be capable of being returned to its original condition; for clothing, keep it unused, unwashed, unaltered, with its tags and original packaging. Statutory exceptions apply, including goods made or altered to your specifications, unless defective.',
          ar: 'طبقًا لقانون حماية المستهلك المصري، تقدر تستبدل أو تسترجع السلعة المؤهلة خلال أربعة عشر يوم تقويمي من استلامها، بدون إبداء سبب أو تحمل مصروفات الإرجاع. لازم تكون السلعة قابلة للعودة لحالتها الأصلية؛ وبالنسبة للملابس تكون غير مستخدمة أو مغسولة أو معدلة ومعها التيكتات والتغليف الأصلي. تسري الاستثناءات القانونية، ومنها السلع المصنوعة أو المعدلة حسب مواصفاتك، إلا إذا كانت معيبة.',
        },
      },
      {
        heading: { en: 'Defective items and refunds', ar: 'السلع المعيبة ورد المبلغ' },
        body: {
          en: 'If an item is defective, you may request replacement or return within 30 calendar days of receiving it, without additional cost, subject to the applicable law. Cash on delivery refunds are arranged through the official customer-care channel after the returned item is received and inspected, without reducing any statutory right.',
          ar: 'لو السلعة فيها عيب، تقدر تطلب استبدالها أو استرجاعها خلال ثلاثين يوم تقويمي من الاستلام، بدون تكلفة إضافية، وفقًا للقانون المعمول به. رد قيمة طلبات الدفع عند الاستلام بيتم ترتيبه من خلال خدمة العملاء الرسمية بعد استلام القطعة وفحصها، من غير ما ينتقص ده من أي حق قانوني ليك.',
        },
      },
      {
        heading: { en: 'Complaints', ar: 'الشكاوى' },
        body: {
          en: 'Please contact KHT first so we can resolve your request. If it is not resolved, you may contact the Egyptian Consumer Protection Agency through cpa.gov.eg. Keep your order reference and proof of purchase.',
          ar: 'تواصل مع KHT أولًا علشان نحل طلبك. لو المشكلة ما اتحلتش، تقدر تتواصل مع جهاز حماية المستهلك من خلال cpa.gov.eg. احتفظ برقم الطلب وإثبات الشراء.',
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
          en: 'We process data when needed to prepare and fulfil your order, meet legal duties, protect the store from abuse, answer support requests, and pursue legitimate operational interests that do not override your rights. Contactable abandoned carts may receive a manual service follow-up, not automated marketing. Commerce records are stored in Cloudflare D1 and product media in Cloudflare R2. KHT does not collect card data.',
          ar: 'بنعالج البيانات بالقدر اللازم لتجهيز وتنفيذ طلبك، والوفاء بالالتزامات القانونية، وحماية المتجر من إساءة الاستخدام، والرد على الدعم، وتحقيق مصالح تشغيلية مشروعة لا تتغلب على حقوقك. ممكن تتم متابعة السلة المتروكة القابلة للتواصل يدويًا لخدمة الطلب، وليس كتسويق آلي. سجلات المتجر محفوظة في Cloudflare D1 وصور المنتجات في Cloudflare R2، وKHT لا يجمع بيانات كروت.',
        },
      },
      {
        heading: { en: 'Retention and your choices', ar: 'مدة الاحتفاظ وحقوقك' },
        body: {
          en: 'We keep order and support records only as long as needed for fulfilment, disputes, fraud prevention, and legal or accounting duties, then delete or anonymise eligible data. You may ask customer care to access, correct, update, restrict, or delete eligible personal data, withdraw consent where processing depends on it, or object where the law allows. Some records must be retained when required by law.',
          ar: 'بنحتفظ بسجلات الطلب والدعم للمدة اللازمة للتنفيذ وحل النزاعات ومنع الاحتيال والالتزامات القانونية أو المحاسبية، وبعدها بنحذف البيانات المؤهلة أو نخليها غير مرتبطة بشخص. تقدر تطلب الوصول لبياناتك أو تصحيحها أو تحديثها أو تقييدها أو حذفها، وسحب الموافقة لو المعالجة معتمدة عليها، أو الاعتراض في الحالات التي يسمح بها القانون. بعض السجلات لازم نحتفظ بها لو القانون بيطلب ده.',
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
