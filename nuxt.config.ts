const environment =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}
const indexingEnabled = environment.NUXT_PUBLIC_STORE_INDEXING_ENABLED === 'true'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-04',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css', '~/assets/css/admin.css', '~/assets/css/account.css'],
  app: {
    head: {
      title: 'KHT — Black. White. Line.',
      script: [
        {
          key: 'google-tag-manager',
          tagPriority: 'critical',
          innerHTML: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-W7SK8385');`,
        },
      ],
      noscript: [
        {
          key: 'google-tag-manager-noscript',
          tagPosition: 'bodyOpen',
          tagPriority: 'critical',
          innerHTML:
            '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W7SK8385" height="0" width="0" style="display:none;visibility:hidden"></iframe>',
        },
      ],
      meta: [
        {
          name: 'description',
          content:
            'KHT. A considered collection of oversized tees, tracksuits and trousers. Black. White. Line.',
        },
        { name: 'theme-color', content: '#0A0A0A' },
        {
          name: 'google-site-verification',
          content: 'HWimPfuQlTJkgv5vxIL-JaVyRFUxfRKQ1df5NoZ2a0Y',
        },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },
  runtimeConfig: {
    public: {
      storeContactEmail: environment.NUXT_PUBLIC_STORE_CONTACT_EMAIL || '',
      storePhone: environment.NUXT_PUBLIC_STORE_PHONE || '',
      storeWhatsApp: environment.NUXT_PUBLIC_STORE_WHATSAPP || '',
      storeIndexingEnabled: indexingEnabled,
      googleTagId: environment.NUXT_PUBLIC_GOOGLE_TAG_ID || '',
    },
  },
  typescript: { strict: true },
})
