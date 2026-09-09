import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const readJsonc = (path: string) =>
  JSON.parse(read(path).replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'))

test('Google Analytics is production-scoped and allowed by the storefront CSP', () => {
  const config = readJsonc('../wrangler.jsonc')
  assert.equal(config.env.production.vars.NUXT_PUBLIC_GOOGLE_TAG_ID, 'G-YHQBDWSBKG')
  assert.equal(config.env.staging.vars.NUXT_PUBLIC_GOOGLE_TAG_ID, '')

  const nuxt = read('../nuxt.config.ts')
  assert.match(nuxt, /googleTagId:\s*environment\.NUXT_PUBLIC_GOOGLE_TAG_ID\s*\|\|\s*''/)

  const layout = read('../app/layouts/default.vue')
  assert.match(layout, /googletagmanager\.com\/gtag\/js\?id=/)
  assert.match(layout, /window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\]/)
  assert.match(layout, /gtag\('config'/)
  assert.match(layout, /\^G-\[A-Z0-9\]\+\$/)

  const security = read('../server/middleware/securityHeaders.ts')
  assert.match(security, /script-src[^\n]*googletagmanager\.com/)
  assert.match(security, /connect-src[^\n]*google-analytics\.com/)
})
