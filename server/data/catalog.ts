import type { Catalog } from '../../shared/types'

// Concept catalog. Replace this data adapter with the chosen commerce provider before launch.
export const catalog: Catalog = {
  demo: true,
  categories: [
    { slug: 'tees', name: { en: 'T-shirts', ar: 'تيشرتات' }, image: '/images/tee.png' },
    { slug: 'sets', name: { en: 'Tracksuits', ar: 'سوت' }, image: '/images/tracksuit.png' },
    { slug: 'pants', name: { en: 'Trousers', ar: 'بناطيل' }, image: '/images/pants.png' },
  ],
  products: [
    {
      id: 'kht-001',
      slug: 'line-oversized-tee',
      code: 'KHT—001',
      category: 'tees',
      price: 890,
      name: { en: 'The Line Tee', ar: 'تيشرت ذا لاين' },
      image: '/images/tee.png',
      description: {
        en: 'An oversized silhouette. One uninterrupted white line. The starting point of the collection.',
        ar: 'قَصّة واسعة وخط أبيض متصل. نقطة البداية للمجموعة.',
      },
      detail: {
        en: 'Black body with a single contrasting chest line. Concept garment; final fabric composition and care instructions will accompany the production collection.',
        ar: 'تيشرت أسود بخط أبيض على الصدر. قطعة تصورية؛ تفاصيل الخامة والعناية النهائية تُضاف مع مجموعة الإنتاج.',
      },
      fit: {
        en: 'Oversized fit. Dropped shoulder. Choose your usual size for a relaxed silhouette.',
        ar: 'قَصّة واسعة وكتف ساقط. اختار مقاسك المعتاد لإطلالة مريحة.',
      },
      sizes: [
        { name: 'S', stock: 8 },
        { name: 'M', stock: 12 },
        { name: 'L', stock: 10 },
        { name: 'XL', stock: 6 },
        { name: 'XXL', stock: 0 },
      ],
    },
    {
      id: 'kht-002',
      slug: 'line-tracksuit',
      code: 'KHT—002',
      category: 'sets',
      price: 2390,
      name: { en: 'The Line Tracksuit', ar: 'سوت ذا لاين' },
      image: '/images/tracksuit.png',
      description: {
        en: 'Two pieces. One direction. A relaxed jacket and matching trousers, connected by the line.',
        ar: 'قطعتان في اتجاه واحد. جاكيت مريح وبنطلون متناسق يجمعهما الخط.',
      },
      detail: {
        en: 'Includes a zip jacket and matching trousers in one size. Concept garment; final fabric composition and care instructions will accompany the production collection.',
        ar: 'يشمل جاكيت بسوستة وبنطلون بنفس المقاس. قطعة تصورية؛ تفاصيل الخامة والعناية النهائية تُضاف مع مجموعة الإنتاج.',
      },
      fit: {
        en: 'Relaxed fit throughout. Jacket and trousers are sold together in the selected size.',
        ar: 'قَصّة مريحة. الجاكيت والبنطلون يُباعان معًا بالمقاس المختار.',
      },
      sizes: [
        { name: 'S', stock: 5 },
        { name: 'M', stock: 8 },
        { name: 'L', stock: 6 },
        { name: 'XL', stock: 4 },
        { name: 'XXL', stock: 0 },
      ],
    },
    {
      id: 'kht-003',
      slug: 'line-wide-leg-trouser',
      code: 'KHT—003',
      category: 'pants',
      price: 1290,
      name: { en: 'The Line Trouser', ar: 'بنطلون ذا لاين' },
      image: '/images/pants.png',
      description: {
        en: 'A wide-leg cut with a clean vertical line. Made to anchor the complete look.',
        ar: 'قَصّة واسعة وخط رأسي واضح. القطعة التي تكمل الإطلالة.',
      },
      detail: {
        en: 'Black trousers with a contrasting side line. Concept garment; final fabric composition and care instructions will accompany the production collection.',
        ar: 'بنطلون أسود بخط جانبي أبيض. قطعة تصورية؛ تفاصيل الخامة والعناية النهائية تُضاف مع مجموعة الإنتاج.',
      },
      fit: {
        en: 'Wide leg. Relaxed waist. Refer to the size guide before choosing.',
        ar: 'رِجل واسعة ووسط مريح. راجع دليل المقاسات قبل الاختيار.',
      },
      sizes: [
        { name: 'S', stock: 6 },
        { name: 'M', stock: 10 },
        { name: 'L', stock: 7 },
        { name: 'XL', stock: 5 },
        { name: 'XXL', stock: 2 },
      ],
    },
  ],
}
