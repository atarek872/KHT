export type ContentLocale = 'en' | 'ar'
export type ContentText = { en: string; ar: string }
export type StorePageKey =
  | 'home'
  | 'shop'
  | 'drop'
  | 'category'
  | 'about'
  | 'sizeGuide'
  | 'trackOrder'
  | 'shipping'
  | 'contact'
  | 'faq'
  | 'privacy'
  | 'terms'

export type StoreHeroContent = {
  enabled: boolean
  eyebrow: ContentText
  title: ContentText
  body: ContentText
  imageUrl: string | null
  mobileImageUrl: string | null
  imageAlt: ContentText
  ctaEnabled: boolean
  ctaLabel: ContentText
  ctaUrl: string
}

export type StoreSeoContent = {
  title: ContentText
  description: ContentText
  socialImageUrl: string | null
}

export type StoreContentSection = {
  id: string
  eyebrow: ContentText
  heading: ContentText
  body: ContentText
  ctaLabel: ContentText
  ctaUrl: string
}

export type StorePageContent = {
  label: string
  hero: StoreHeroContent
  seo: StoreSeoContent
  sections: StoreContentSection[]
}

export type StoreNavigationItem = {
  id: string
  label: ContentText
  href: string
  enabled: boolean
  desktop: boolean
  mobile: boolean
  mobileSection: 'main' | 'bottom'
  footerColumn: 'none' | 'collection' | 'care'
}

export type StoreBrandContent = {
  name: string
  logoUrl: string | null
  tagline: ContentText
  subline: ContentText
  announcementStart: ContentText
  announcementCenter: ContentText
  announcementEnd: ContentText
  footerCollectionTitle: ContentText
  footerCareTitle: ContentText
  footerStatement: ContentText
  footerStatementLinkLabel: ContentText
  footerStatementLinkUrl: string
  footerPaymentLine: ContentText
  privacyLabel: ContentText
  termsLabel: ContentText
  contactEmail: string
  contactPhone: string
  contactWhatsApp: string
  instagramUrl: string
  facebookUrl: string
  tiktokUrl: string
  defaultSocialImageUrl: string
}

export type StorefrontContent = {
  brand: StoreBrandContent
  navigation: StoreNavigationItem[]
  pages: Record<StorePageKey, StorePageContent>
}

const text = (en: string, ar: string): ContentText => ({ en, ar })
const section = (
  id: string,
  heading: ContentText,
  body: ContentText,
  eyebrow = text('', ''),
  ctaLabel = text('', ''),
  ctaUrl = '/',
): StoreContentSection => ({ id, eyebrow, heading, body, ctaLabel, ctaUrl })
const hero = (
  title: ContentText,
  body: ContentText,
  overrides: Partial<StoreHeroContent> = {},
): StoreHeroContent => ({
  enabled: false,
  eyebrow: text('KHT / THE FIRST CHAPTER', 'KHT / الفصل الأول'),
  title,
  body,
  imageUrl: null,
  mobileImageUrl: null,
  imageAlt: title,
  ctaEnabled: false,
  ctaLabel: text('Explore', 'اكتشف'),
  ctaUrl: '/shop',
  ...overrides,
})
const seo = (
  title: ContentText,
  description: ContentText,
  socialImageUrl: string | null = null,
) => ({
  title,
  description,
  socialImageUrl,
})

export const DEFAULT_STORE_CONTENT: StorefrontContent = {
  brand: {
    name: 'KHT',
    logoUrl: null,
    tagline: text('BLACK. WHITE. LINE.', 'أسود. أبيض. خط.'),
    subline: text('Nothing more. Nothing less.', 'من غير زيادة. من غير نقصان.'),
    announcementStart: text('DROP 001 — THE FIRST CHAPTER', 'الإصدار 001 — الفصل الأول'),
    announcementCenter: text('BLACK. WHITE. LINE.', 'أسود. أبيض. خط.'),
    announcementEnd: text('THE KHT COLLECTION', 'مجموعة KHT'),
    footerCollectionTitle: text('Collection', 'المجموعة'),
    footerCareTitle: text('Customer care', 'المساعدة'),
    footerStatement: text('THE LINE CONNECTS US.', 'الخط يجمعنا.'),
    footerStatementLinkLabel: text('Discover the story', 'اعرف الحكاية'),
    footerStatementLinkUrl: '/about',
    footerPaymentLine: text('Cash on delivery · Egypt', 'الدفع عند الاستلام · مصر'),
    privacyLabel: text('Privacy', 'الخصوصية'),
    termsLabel: text('Terms', 'الشروط'),
    contactEmail: 'kht.egstore@gmail.com',
    contactPhone: '',
    contactWhatsApp: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
    defaultSocialImageUrl: '/images/campaign.png',
  },
  navigation: [
    {
      id: 'shop',
      label: text('Shop all', 'كل المنتجات'),
      href: '/shop',
      enabled: true,
      desktop: true,
      mobile: true,
      mobileSection: 'main',
      footerColumn: 'collection',
    },
    {
      id: 'drop-001',
      label: text('Drop 001', 'الإصدار 001'),
      href: '/drops/001',
      enabled: true,
      desktop: true,
      mobile: true,
      mobileSection: 'main',
      footerColumn: 'none',
    },
    {
      id: 'about',
      label: text('Our story', 'عن KHT'),
      href: '/about',
      enabled: true,
      desktop: true,
      mobile: true,
      mobileSection: 'main',
      footerColumn: 'none',
    },
    {
      id: 'track-account',
      label: text('Track order', 'تتبع الطلب'),
      href: '/account/orders',
      enabled: true,
      desktop: false,
      mobile: true,
      mobileSection: 'main',
      footerColumn: 'none',
    },
    {
      id: 'size-guide',
      label: text('Size guide', 'دليل المقاسات'),
      href: '/size-guide',
      enabled: true,
      desktop: false,
      mobile: true,
      mobileSection: 'bottom',
      footerColumn: 'care',
    },
    {
      id: 'shipping',
      label: text('Shipping & returns', 'الشحن والاسترجاع'),
      href: '/shipping',
      enabled: true,
      desktop: false,
      mobile: true,
      mobileSection: 'bottom',
      footerColumn: 'care',
    },
    {
      id: 'track-order',
      label: text('Your order', 'طلبك'),
      href: '/track-order',
      enabled: true,
      desktop: false,
      mobile: false,
      mobileSection: 'main',
      footerColumn: 'care',
    },
    {
      id: 'contact',
      label: text('Contact', 'تواصل معنا'),
      href: '/contact',
      enabled: true,
      desktop: false,
      mobile: false,
      mobileSection: 'main',
      footerColumn: 'care',
    },
  ],
  pages: {
    home: {
      label: 'Homepage',
      hero: hero(
        text('BLACK.\nWHITE.\nLINE.', 'أسود.\nأبيض.\nخط.'),
        text(
          'Stripped back. Standing apart.\nA new uniform. A single line.',
          'تفاصيل أقل. حضور أقوى.\nإطلالة جديدة. خط واحد.',
        ),
        {
          enabled: true,
          eyebrow: text('DROP 001 / THE ORIGIN', 'الإصدار 001 / البداية'),
          imageUrl: '/images/campaign.png',
          imageAlt: text(
            'Two models in black KHT streetwear with signature white lines',
            'موديلان بملابس KHT السوداء وخطوط بيضاء مميزة',
          ),
          ctaEnabled: true,
          ctaLabel: text('SHOP DROP 001', 'تسوق الإصدار 001'),
          ctaUrl: '/drops/001',
        },
      ),
      seo: seo(
        text('KHT — Black. White. Line.', 'KHT — أسود. أبيض. خط.'),
        text(
          'Meet Drop 001. Oversized silhouettes. Considered details. A single white line.',
          'اكتشف إصدار KHT 001: قصّات أوفر سايز وتفاصيل مدروسة وخط أبيض واحد.',
        ),
        '/images/campaign.png',
      ),
      sections: [
        section(
          'collection',
          text('THE ESSENTIALS.', 'القطع الأساسية.'),
          text('Three silhouettes. One identity.', 'ثلاث قصّات. هوية واحدة.'),
          text('THE FIRST CHAPTER', 'الفصل الأول'),
          text('Explore the collection', 'اكتشف المجموعة'),
          '/shop',
        ),
        section(
          'manifesto',
          text('NOTHING EXTRA.\nEVERYTHING\nINTENTIONAL.', 'من غير زيادة.\nكل تفصيلة\nمقصودة.'),
          text(
            'We start with black. Add white. Draw a line. What remains is a collection built around shape, movement and the details that matter.',
            'نبدأ بالأسود. نضيف الأبيض. نرسم خط. النتيجة مجموعة تتمحور حول القَصّة والحركة والتفاصيل المهمة.',
          ),
          text('THE KHT PHILOSOPHY', 'فلسفة KHT'),
          text('The story behind the line', 'الحكاية ورا الخط'),
          '/about',
        ),
        section(
          'categories',
          text('FIND YOUR FORM.', 'اختار إطلالتك.'),
          text('EXPLORE BY CATEGORY', 'تصفح حسب النوع'),
        ),
        section(
          'closing',
          text('FOLLOW\nTHE LINE.', 'اتبع\nالخط.'),
          text('', ''),
          text('DROP 001', 'الإصدار 001'),
          text('Find your piece', 'اختار قطعتك'),
          '/shop',
        ),
      ],
    },
    shop: {
      label: 'Shop',
      hero: hero(
        text('THE COLLECTION.', 'المجموعة.'),
        text('Black. White. A line that makes it yours.', 'أسود. أبيض. خط يشبهك.'),
        {
          eyebrow: text('KHT / DROP 001', 'KHT / الإصدار 001'),
          imageUrl: '/images/campaign.png',
          imageAlt: text('KHT Drop 001 collection', 'مجموعة KHT إصدار 001'),
        },
      ),
      seo: seo(
        text(
          'KHT Streetwear Collection — Shop Drop 001',
          'مجموعة KHT ستريت وير — تسوق الإصدار 001',
        ),
        text(
          'Shop KHT black streetwear in Egypt. Explore oversized hoodies, wide-leg pants and complete sets from Drop 001.',
          'تسوق ملابس KHT السوداء في مصر. اكتشف الهوديز الأوفر سايز والبناطيل الواسعة والأطقم الكاملة من إصدار 001.',
        ),
        '/images/campaign.png',
      ),
      sections: [],
    },
    drop: {
      label: 'Drop 001',
      hero: hero(
        text('DROP 001.', 'الإصدار 001.'),
        text('Black. White. A line that makes it yours.', 'أسود. أبيض. خط يشبهك.'),
        {
          enabled: true,
          eyebrow: text('THE ORIGIN / KHT COLLECTION', 'البداية / مجموعة KHT'),
          imageUrl: '/images/drop-001-banner.jpg',
          imageAlt: text(
            'Black KHT hooded set, front and back views',
            'سوت KHT أسود، من الأمام والخلف',
          ),
        },
      ),
      seo: seo(
        text(
          'KHT Drop 001 — Black Streetwear Collection',
          'إصدار KHT 001 — مجموعة ستريت وير سوداء',
        ),
        text(
          'Shop KHT Drop 001: oversized hoodies, wide-leg pants and complete black streetwear sets with the signature white line.',
          'تسوق إصدار KHT 001: هوديز أوفر سايز وبناطيل واسعة وأطقم ستريت وير سوداء كاملة بخط KHT الأبيض المميز.',
        ),
        '/images/drop-001-banner.jpg',
      ),
      sections: [],
    },
    category: {
      label: 'Category template',
      hero: hero(
        text('KHT COLLECTION.', 'مجموعة KHT.'),
        text('Black. White. A line that makes it yours.', 'أسود. أبيض. خط يشبهك.'),
        { eyebrow: text('KHT / DROP 001', 'KHT / الإصدار 001') },
      ),
      seo: seo(
        text('KHT Collection', 'مجموعة KHT'),
        text('Explore KHT pieces from Drop 001.', 'اكتشف قطع KHT من إصدار 001.'),
      ),
      sections: [],
    },
    about: {
      label: 'About',
      hero: hero(
        text('IT STARTS\nWITH A LINE.', 'البداية\nخط.'),
        text(
          'Black gives it shape. White gives it definition. The line gives it an identity.',
          'الأسود يرسم الشكل. الأبيض يوضح التفاصيل. والخط يديها هوية.',
        ),
        {
          enabled: true,
          eyebrow: text('KHT / OUR STORY', 'KHT / حكايتنا'),
          imageUrl: '/images/our-story-cover.png',
          imageAlt: text('KHT Black. White. Line. brand cover', 'غلاف KHT أسود. أبيض. خط.'),
          ctaEnabled: true,
          ctaLabel: text('Explore the first chapter', 'اكتشف الفصل الأول'),
          ctaUrl: '/shop',
        },
      ),
      seo: seo(
        text('The KHT Story — Black. White. Line.', 'حكاية KHT — أسود. أبيض. خط.'),
        text(
          'Discover KHT, an Egyptian streetwear label built around considered black silhouettes and one signature white line.',
          'اكتشف KHT، علامة ستريت وير مصرية مبنية على قصّات سوداء مدروسة وخط أبيض مميز.',
        ),
        '/images/our-story-cover.png',
      ),
      sections: [
        section(
          'story',
          text('OUR PHILOSOPHY.', 'فلسفتنا.'),
          text(
            'KHT is a study in doing less, with intention. A wardrobe of considered silhouettes connected by a single detail. Across a tee, a tracksuit and a pair of trousers, the line stays the same. The way you wear it is yours.',
            'KHT دراسة في البساطة المقصودة. قصّات مدروسة يجمعها تفصيل واحد. من التيشرت للسوت للبنطلون، الخط ثابت. وطريقتك في اللبس تخصك.',
          ),
        ),
      ],
    },
    sizeGuide: {
      label: 'Size Guide',
      hero: hero(
        text('FIND YOUR FIT.', 'اختار مقاسك.'),
        text('Choose the intended KHT fit before ordering.', 'اختار القَصّة المناسبة قبل الطلب.'),
        {
          eyebrow: text('KHT / SIZE GUIDE', 'KHT / دليل المقاسات'),
          imageUrl: '/images/campaign.png',
          imageAlt: text('KHT size guide', 'دليل مقاسات KHT'),
        },
      ),
      seo: seo(
        text('KHT Size Guide — Find Your Fit', 'دليل مقاسات KHT — اختار مقاسك'),
        text(
          'Use the KHT size guide to choose the intended oversized fit for Drop 001 hoodies, pants and complete sets.',
          'استخدم دليل مقاسات KHT لاختيار القَصّة الأوفر سايز المناسبة لهوديز وبناطيل وأطقم إصدار 001.',
        ),
        '/images/campaign.png',
      ),
      sections: [],
    },
    trackOrder: {
      label: 'Track Order',
      hero: hero(
        text('FOLLOW YOUR PIECE.', 'تابع قطعتك.'),
        text(
          'Enter the order reference and the same phone number used at checkout.',
          'اكتب رقم الطلب ونفس رقم الموبايل اللي استخدمته وقت الطلب.',
        ),
        {
          eyebrow: text('KHT / YOUR ORDER', 'KHT / طلبك'),
          imageUrl: '/images/campaign.png',
          imageAlt: text('Track your KHT order', 'تتبع طلب KHT'),
        },
      ),
      seo: seo(
        text('Track your order — KHT', 'تتبع طلبك — KHT'),
        text('Track the latest status of your KHT order.', 'تابع آخر حالة لطلبك من KHT.'),
      ),
      sections: [],
    },
    shipping: {
      label: 'Shipping & Returns',
      hero: hero(
        text('SHIPPING & RETURNS.', 'الشحن والاسترجاع.'),
        text(
          'Delivery, inspection, exchange and return information.',
          'معلومات التوصيل والفحص والاستبدال والاسترجاع.',
        ),
        { eyebrow: text('KHT / CUSTOMER CARE', 'KHT / المساعدة') },
      ),
      seo: seo(
        text('Shipping & Returns — KHT', 'الشحن والاسترجاع — KHT'),
        text(
          'KHT delivery, inspection, exchange and return information for Egypt.',
          'معلومات التوصيل والفحص والاستبدال والاسترجاع لطلبات KHT داخل مصر.',
        ),
      ),
      sections: [
        section(
          'delivery',
          text('Delivery and cash on delivery', 'التوصيل والدفع عند الاستلام'),
          text(
            'Available governorates and the delivery charge are shown before you place the order. Orders use cash on delivery. The courier will contact you to coordinate delivery, and you must provide a reachable phone number and accurate address.',
            'المحافظات المتاحة وتكلفة الشحن بيظهروا قبل تسجيل الطلب. الدفع عند الاستلام فقط، وشركة الشحن هتتواصل معاك لتنسيق الموعد؛ لذلك لازم تكتب رقم موبايل متاح وعنوان دقيق.',
          ),
        ),
        section(
          'inspection',
          text('Inspection at delivery', 'فحص الطلب عند الاستلام'),
          text(
            'You may request inspection at delivery where the courier permits it. If the item is wrong, damaged, or materially different from the confirmed order, refuse it and contact KHT through the official customer-care channel. This inspection option does not limit your statutory return rights.',
            'تقدر تطلب فحص الطلب عند الاستلام إذا كانت شركة الشحن تسمح بذلك. لو القطعة غلط أو تالفة أو مختلفة بشكل واضح عن الطلب المؤكد، ارفضها وتواصل مع KHT من خلال خدمة العملاء الرسمية. إمكانية الفحص لا تقلل من حقوقك القانونية في الاستبدال أو الاسترجاع.',
          ),
        ),
        section(
          'returns',
          text('14-day returns', 'الاستبدال والاسترجاع خلال 14 يوم'),
          text(
            'Under Egyptian Consumer Protection Law, you may exchange or return an eligible item within 14 calendar days of receiving it, without giving a reason or bearing return costs. The item must be capable of being returned to its original condition; for clothing, keep it unused, unwashed, unaltered, with its tags and original packaging. Statutory exceptions apply, including goods made or altered to your specifications, unless defective.',
            'طبقًا لقانون حماية المستهلك المصري، تقدر تستبدل أو تسترجع السلعة المؤهلة خلال أربعة عشر يوم تقويمي من استلامها، بدون إبداء سبب أو تحمل مصروفات الإرجاع. لازم تكون السلعة قابلة للعودة لحالتها الأصلية؛ وبالنسبة للملابس تكون غير مستخدمة أو مغسولة أو معدلة ومعها التيكتات والتغليف الأصلي. تسري الاستثناءات القانونية، ومنها السلع المصنوعة أو المعدلة حسب مواصفاتك، إلا إذا كانت معيبة.',
          ),
        ),
        section(
          'defects',
          text('Defective items and refunds', 'السلع المعيبة ورد المبلغ'),
          text(
            'If an item is defective, you may request replacement or return within 30 calendar days of receiving it, without additional cost, subject to the applicable law. Cash on delivery refunds are arranged through the official customer-care channel after the returned item is received and inspected, without reducing any statutory right.',
            'لو السلعة فيها عيب، تقدر تطلب استبدالها أو استرجاعها خلال ثلاثين يوم تقويمي من الاستلام، بدون تكلفة إضافية، وفقًا للقانون المعمول به. رد قيمة طلبات الدفع عند الاستلام بيتم ترتيبه من خلال خدمة العملاء الرسمية بعد استلام القطعة وفحصها، من غير ما ينتقص ده من أي حق قانوني ليك.',
          ),
        ),
        section(
          'complaints',
          text('Complaints', 'الشكاوى'),
          text(
            'Please contact KHT first so we can resolve your request. If it is not resolved, you may contact the Egyptian Consumer Protection Agency through cpa.gov.eg. Keep your order reference and proof of purchase.',
            'تواصل مع KHT أولًا علشان نحل طلبك. لو المشكلة ما اتحلتش، تقدر تتواصل مع جهاز حماية المستهلك من خلال cpa.gov.eg. احتفظ برقم الطلب وإثبات الشراء.',
          ),
        ),
      ],
    },
    contact: {
      label: 'Contact',
      hero: hero(
        text('LET’S CONNECT.', 'نتواصل.'),
        text(
          'Use the official KHT channels for order and customer-care support.',
          'استخدم وسائل KHT الرسمية لدعم الطلبات وخدمة العملاء.',
        ),
        { eyebrow: text('KHT / CUSTOMER CARE', 'KHT / المساعدة') },
      ),
      seo: seo(
        text('Contact KHT', 'تواصل مع KHT'),
        text(
          'Contact KHT customer care for order, exchange, or privacy support.',
          'تواصل مع خدمة عملاء KHT لدعم الطلبات أو الاستبدال أو الخصوصية.',
        ),
      ),
      sections: [
        section(
          'care',
          text('KHT customer care', 'خدمة عملاء KHT'),
          text(
            'Use the official channels shown on this page for order, exchange, or privacy support. Keep your order reference so we can help you quickly.',
            'استخدم بيانات التواصل الرسمية الظاهرة في الصفحة بخصوص الطلبات أو الاستبدال أو الخصوصية. احتفظ برقم الطلب علشان نقدر نساعدك بسرعة.',
          ),
        ),
        section(
          'safety',
          text('Explore in the meantime', 'اكتشف المجموعة'),
          text(
            'For order support, include your order reference and the phone number used at checkout. Never send passwords or payment-card details; KHT currently accepts cash on delivery only.',
            'للدعم الخاص بالطلبات، ابعت رقم الطلب ورقم الموبايل المستخدم وقت الشراء. ما تبعتش كلمات سر أو بيانات كروت؛ KHT بيقبل الدفع عند الاستلام فقط حاليًا.',
          ),
        ),
      ],
    },
    faq: {
      label: 'FAQ',
      hero: hero(
        text('A FEW ANSWERS.', 'إجابات تهمك.'),
        text('Quick answers about ordering and fit.', 'إجابات سريعة عن الطلب والمقاسات.'),
        { eyebrow: text('KHT / CUSTOMER CARE', 'KHT / المساعدة') },
      ),
      seo: seo(
        text('Frequently Asked Questions — KHT', 'الأسئلة الشائعة — KHT'),
        text(
          'Answers about KHT ordering, payment, delivery and product fit.',
          'إجابات عن طلبات KHT والدفع والتوصيل والمقاسات.',
        ),
      ),
      sections: [
        section(
          'ordering',
          text('Can I order now?', 'أقدر أطلب دلوقتي؟'),
          text(
            'Yes. Add available items to your bag, enter accurate delivery details, and place a cash on delivery order. Keep the reference shown after checkout.',
            'أيوه. ضيف القطع المتاحة للسلة، واكتب بيانات توصيل صحيحة، وسجّل طلب دفع عند الاستلام. احتفظ برقم الطلب اللي هيظهر بعد الإتمام.',
          ),
        ),
        section(
          'fit',
          text('How does the tracksuit fit?', 'مقاس السوت إزاي؟'),
          text(
            'A tracksuit uses the same selected size for the jacket and trousers unless its product page says otherwise. Check the size guide before ordering.',
            'السوت بيستخدم نفس المقاس المختار للجاكيت والبنطلون إلا لو صفحة المنتج قالت غير كده. راجع دليل المقاسات قبل الطلب.',
          ),
        ),
      ],
    },
    privacy: {
      label: 'Privacy',
      hero: hero(
        text('YOUR PRIVACY.', 'خصوصيتك.'),
        text(
          'How KHT handles store and order information.',
          'إزاي KHT بيتعامل مع بيانات المتجر والطلبات.',
        ),
        { eyebrow: text('KHT / CUSTOMER CARE', 'KHT / المساعدة') },
      ),
      seo: seo(
        text('Privacy — KHT', 'الخصوصية — KHT'),
        text(
          'How KHT collects, uses, stores and protects customer information.',
          'كيفية جمع KHT لبيانات العملاء واستخدامها وتخزينها وحمايتها.',
        ),
      ),
      sections: [
        section(
          'collection',
          text('What we collect', 'البيانات اللي بنجمعها'),
          text(
            'KHT stores your language choice and cart contents in browser cookies. When you enter a valid phone number or email at checkout, we may save your name, contact details, and cart contents so customer care can identify an abandoned cart. Placing an order also stores the delivery address, order lines, totals, status, and support history.',
            'KHT بيحفظ اختيار اللغة ومحتويات السلة في ملفات تعريف الارتباط. لما تدخل رقم موبايل أو بريد صحيح في إتمام الطلب، ممكن نحفظ الاسم وبيانات التواصل ومحتويات السلة علشان خدمة العملاء تقدر تحدد السلة المتروكة. تسجيل الطلب بيحفظ كمان عنوان التوصيل والقطع والإجماليات والحالة وسجل الدعم.',
          ),
        ),
        section(
          'use',
          text('How data is used and stored', 'استخدام البيانات وتخزينها'),
          text(
            'We process data when needed to prepare and fulfil your order, meet legal duties, protect the store from abuse, answer support requests, and pursue legitimate operational interests that do not override your rights. Contactable abandoned carts may receive a manual service follow-up, not automated marketing. Commerce records are stored in Cloudflare D1 and product media in Cloudflare R2. KHT does not collect card data.',
            'بنعالج البيانات بالقدر اللازم لتجهيز وتنفيذ طلبك، والوفاء بالالتزامات القانونية، وحماية المتجر من إساءة الاستخدام، والرد على الدعم، وتحقيق مصالح تشغيلية مشروعة لا تتغلب على حقوقك. ممكن تتم متابعة السلة المتروكة القابلة للتواصل يدويًا لخدمة الطلب، وليس كتسويق آلي. سجلات المتجر محفوظة في Cloudflare D1 وصور المنتجات في Cloudflare R2، وKHT لا يجمع بيانات كروت.',
          ),
        ),
        section(
          'retention',
          text('Retention and your choices', 'مدة الاحتفاظ وحقوقك'),
          text(
            'We keep order and support records only as long as needed for fulfilment, disputes, fraud prevention, and legal or accounting duties, then delete or anonymise eligible data. You may ask customer care to access, correct, update, restrict, or delete eligible personal data, withdraw consent where processing depends on it, or object where the law allows. Some records must be retained when required by law.',
            'بنحتفظ بسجلات الطلب والدعم للمدة اللازمة للتنفيذ وحل النزاعات ومنع الاحتيال والالتزامات القانونية أو المحاسبية، وبعدها بنحذف البيانات المؤهلة أو نخليها غير مرتبطة بشخص. تقدر تطلب الوصول لبياناتك أو تصحيحها أو تحديثها أو تقييدها أو حذفها، وسحب الموافقة لو المعالجة معتمدة عليها، أو الاعتراض في الحالات التي يسمح بها القانون. بعض السجلات لازم نحتفظ بها لو القانون بيطلب ده.',
          ),
        ),
      ],
    },
    terms: {
      label: 'Terms',
      hero: hero(
        text('THE DETAILS.', 'التفاصيل.'),
        text(
          'The terms that apply when using and ordering from KHT.',
          'الشروط المطبقة عند استخدام KHT والطلب منه.',
        ),
        { eyebrow: text('KHT / CUSTOMER CARE', 'KHT / المساعدة') },
      ),
      seo: seo(
        text('Terms — KHT', 'الشروط — KHT'),
        text('Terms for ordering and using the KHT storefront.', 'شروط الطلب واستخدام متجر KHT.'),
      ),
      sections: [
        section(
          'ordering',
          text('Ordering and payment', 'الطلب والدفع'),
          text(
            'Submitting checkout creates a cash on delivery order using the items, address, and phone number you provide. Prices, discounts, delivery, and stock are recalculated by KHT when the order is placed. An order reference confirms receipt, not guaranteed fulfilment; KHT may contact you to confirm or cancel unavailable or suspicious orders.',
            'إرسال بيانات إتمام الطلب بينشئ طلب دفع عند الاستلام بالقطع والعنوان ورقم الموبايل اللي قدمتهم. KHT بيعيد حساب الأسعار والخصومات والشحن والمخزون وقت تسجيل الطلب. رقم الطلب يؤكد استلامه لكنه مش ضمان للتنفيذ؛ ممكن KHT يتواصل معاك للتأكيد أو يلغي الطلب غير المتاح أو المشتبه فيه.',
          ),
        ),
        section(
          'accuracy',
          text('Accuracy and availability', 'دقة البيانات والتوفر'),
          text(
            'You are responsible for accurate contact and delivery details and for being available to receive the parcel. Product colour can vary slightly by screen. If a pricing, stock, or description error affects an order, KHT will contact you before fulfilment and may correct or cancel it.',
            'أنت مسؤول عن صحة بيانات التواصل والتوصيل والتواجد لاستلام الشحنة. لون المنتج ممكن يختلف بدرجة بسيطة حسب الشاشة. لو فيه خطأ في السعر أو المخزون أو الوصف مؤثر على الطلب، KHT هيتواصل معاك قبل التنفيذ وممكن يصححه أو يلغيه.',
          ),
        ),
        section(
          'acceptable-use',
          text('Cancellations and acceptable use', 'الإلغاء والاستخدام المقبول'),
          text(
            'Ask customer care to cancel before the order is shipped. Repeated false orders, abusive activity, automated requests, or attempts to interfere with the store may be rejected. Shipping, exchange, privacy, and any product-specific conditions form part of these terms.',
            'اطلب الإلغاء من خدمة العملاء قبل شحن الطلب. الطلبات الوهمية المتكررة أو الإساءة أو الطلبات الآلية أو محاولة تعطيل المتجر ممكن يتم رفضها. شروط الشحن والاستبدال والخصوصية وأي شروط خاصة بالمنتج جزء من الشروط دي.',
          ),
        ),
      ],
    },
  },
}

export function cloneStoreContent(content: StorefrontContent = DEFAULT_STORE_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as StorefrontContent
}

export type StoreContentVersion = { id: string; publishedAt: string; publishedBy: string }
export type AdminStoreContentState = {
  draft: StorefrontContent
  published: StorefrontContent
  draftUpdatedAt: string
  draftUpdatedBy: string
  publishedAt: string
  publishedBy: string
  hasUnpublishedChanges: boolean
  versions: StoreContentVersion[]
}
export type PublicStoreContent = { content: StorefrontContent; revision: string }
