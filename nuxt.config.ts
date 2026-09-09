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
      meta: [
        {
          name: 'description',
          content:
            'KHT. A considered collection of oversized tees, tracksuits and trousers. Black. White. Line.',
        },
        { name: 'theme-color', content: '#0A0A0A' },
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
