import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const entry = resolve('dist/server/index.js')
const assets = resolve('dist/client')
const hosting = resolve('dist/.openai/hosting.json')

if (!existsSync(entry) || !existsSync(assets) || !existsSync(hosting)) {
  throw new Error('Cloudflare build output is incomplete. Run npm run build:cloudflare first.')
}

const entrySource = readFileSync(entry, 'utf8')
const reexport = entrySource.match(/export\s*\{\s*default\s*\}\s*from\s*['"](.+)['"]/)
const workerEntry = reexport ? resolve(dirname(entry), reexport[1]) : entry
const workerSource = readFileSync(workerEntry, 'utf8')

if (
  !/async\s+fetch\s*\(/.test(workerSource) ||
  !/export\s*\{[^}]+\bas\s+default\s*\}/.test(workerSource)
) {
  throw new Error('Cloudflare Worker default export must provide a callable fetch method.')
}

console.log('Cloudflare Worker entrypoint and staged assets verified.')
