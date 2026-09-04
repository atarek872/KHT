export default defineNuxtConfig({
  compatibilityDate: '2026-09-04',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
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
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },
  typescript: { strict: true },
})
