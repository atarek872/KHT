import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const readJsonc = (path: string) => JSON.parse(read(path).replace(/,\s*([}\]])/g, '$1'))

test('staging config binds isolated D1 and R2 with indexing disabled', () => {
  const config = readJsonc('../wrangler.jsonc')
  const staging = config.env.staging

  assert.equal(config.main, 'dist/server/index.js')
  assert.ok(config.compatibility_flags.includes('nodejs_compat'))
  assert.deepEqual(config.assets, { directory: 'dist/client', binding: 'ASSETS' })
  assert.equal(staging.name, 'kht-commerce-staging')
  assert.equal(staging.workers_dev, true)
  assert.equal(staging.preview_urls, false)
  assert.deepEqual(staging.d1_databases, [
    {
      binding: 'DB',
      database_name: 'kht-commerce-staging',
      database_id: '50faffb0-405c-43c1-a44a-ec9db275c417',
      migrations_dir: 'server/db/migrations',
    },
  ])
  assert.deepEqual(staging.r2_buckets, [
    { binding: 'PRODUCT_MEDIA', bucket_name: 'kht-product-media-staging' },
  ])
  assert.equal(staging.vars.NUXT_PUBLIC_STORE_INDEXING_ENABLED, 'false')
  assert.equal(staging.vars.NUXT_PUBLIC_STORE_CONTACT_EMAIL, '')
  assert.equal(staging.vars.NUXT_PUBLIC_STORE_PHONE, '')
  assert.equal(staging.vars.NUXT_PUBLIC_STORE_WHATSAPP, '')
})

test('production candidate uses isolated public Cloudflare resources and real contact details', () => {
  const config = readJsonc('../wrangler.jsonc')
  const production = config.env.production

  assert.equal(production.name, 'kht-commerce-production')
  assert.equal(production.workers_dev, true)
  assert.equal(production.preview_urls, false)
  assert.deepEqual(production.routes, [
    { pattern: 'kht.tknology.online', custom_domain: true },
  ])
  assert.notEqual(
    production.d1_databases[0].database_id,
    config.env.staging.d1_databases[0].database_id,
  )
  assert.deepEqual(production.d1_databases[0], {
    binding: 'DB',
    database_name: 'kht-commerce-production',
    database_id: production.d1_databases[0].database_id,
    migrations_dir: 'server/db/migrations',
  })
  assert.deepEqual(production.r2_buckets, [
    { binding: 'PRODUCT_MEDIA', bucket_name: 'kht-product-media-production' },
  ])
  assert.equal(production.vars.NUXT_PUBLIC_STORE_INDEXING_ENABLED, 'false')
  assert.equal(production.vars.NUXT_PUBLIC_STORE_CONTACT_EMAIL, 'atarek872@hotmail.com')
  assert.equal(production.vars.NUXT_PUBLIC_STORE_PHONE, '01124023663')
  assert.equal(production.vars.NUXT_PUBLIC_STORE_WHATSAPP, '')
  assert.deepEqual(production.observability, { enabled: true, head_sampling_rate: 1 })
})

test('Sites metadata keeps only logical persistence bindings', () => {
  const hosting = JSON.parse(read('../.openai/hosting.json'))

  assert.equal(hosting.project_id, 'appgprj_6a9ac818038c8191ae7f6212d9281388')
  assert.equal(hosting.d1, 'DB')
  assert.equal(hosting.r2, 'PRODUCT_MEDIA')
  assert.equal(hosting.static, undefined)
})

test('staging verification checks the callable Worker entrypoint', () => {
  const script = read('../scripts/verify-cloudflare-build.mjs')
  const packageJson = JSON.parse(read('../package.json'))

  assert.match(script, /dist\/server\/index\.js/)
  assert.match(script, /readFileSync/)
  assert.match(script, /async\\s\+fetch/)
  assert.doesNotMatch(script, /await import/)
  assert.equal(
    packageJson.scripts['verify:cloudflare-build'],
    'node scripts/verify-cloudflare-build.mjs',
  )
})

test('Cloudflare builds remove stale staged output before compiling', () => {
  const packageJson = JSON.parse(read('../package.json'))
  assert.match(packageJson.scripts['build:cloudflare'], /^node scripts\/clean-cloudflare-build\.mjs &&/)
  const cleaner = read('../scripts/clean-cloudflare-build.mjs')
  assert.match(cleaner, /join\(project, 'dist'\)/)
  assert.match(cleaner, /isSymbolicLink\(\)/)
  assert.match(cleaner, /rmSync\(staging, \{ recursive: true \}\)/)
})

test('staging credentials and deployment artifacts are ignored', () => {
  const ignore = read('../.gitignore')

  assert.match(ignore, /^\.staging-admin(?:\..*)?$/m)
  assert.match(ignore, /^\.production-admin(?:\..*)?$/m)
  assert.match(ignore, /^\.cloudflare-deploy\/$/m)
})

test('admin password hashes stay within the Cloudflare Workers PBKDF2 limit', () => {
  const generator = read('../scripts/create-admin-password-hash.mjs')

  assert.match(generator, /const iterations = 100000\b/)
})

test('D1 migrations use LF endings for remote trigger compatibility', () => {
  const attributes = read('../.gitattributes')
  const migrationsDirectory = new URL('../server/db/migrations/', import.meta.url)

  assert.match(attributes, /^server\/db\/migrations\/\*\.sql text eol=lf$/m)

  for (const migration of readdirSync(migrationsDirectory).filter((file) =>
    file.endsWith('.sql'),
  )) {
    const contents = readFileSync(new URL(migration, migrationsDirectory))
    assert.equal(contents.includes(13), false, `${migration} contains CRLF line endings`)

    const triggerBlocks: string[] = []
    let trigger = ''
    for (const line of contents.toString('utf8').split('\n')) {
      if (line.startsWith('CREATE TRIGGER ')) trigger = line
      else if (trigger) trigger += `\n${line}`

      if (trigger && line === 'END;') {
        triggerBlocks.push(trigger)
        trigger = ''
      }
    }

    for (const block of triggerBlocks) {
      assert.doesNotMatch(
        block,
        /\bSELECT\s+CASE\b/i,
        `${migration} has a CASE expression inside a trigger body`,
      )
    }
  }
})
