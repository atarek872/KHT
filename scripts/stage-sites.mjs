import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { resolve, join } from 'node:path'

const project = resolve(import.meta.dirname, '..')
const output = join(project, '.output')
const staging = join(project, 'dist')
if (!existsSync(join(output, 'server/index.mjs')))
  throw new Error('Run the Nuxt Cloudflare build before staging.')
// Only replace this project's generated dist directory, never a linked/external target.
if (existsSync(staging)) {
  if (
    lstatSync(staging).isSymbolicLink() ||
    realpathSync(staging) !== join(realpathSync(project), 'dist')
  )
    throw new Error('The build staging directory must be inside this project.')
  rmSync(staging, { recursive: true })
}
mkdirSync(join(staging, 'server'), { recursive: true })
mkdirSync(join(staging, 'client'), { recursive: true })
mkdirSync(join(staging, '.openai'), { recursive: true })
cpSync(join(output, 'server'), join(staging, 'server'), { recursive: true })
cpSync(join(output, 'public'), join(staging, 'client'), { recursive: true })
cpSync(join(project, '.openai/hosting.json'), join(staging, '.openai/hosting.json'))
writeFileSync(join(staging, 'server/index.js'), "export { default } from './index.mjs';\n")
console.log('Nuxt Cloudflare worker and public assets staged for Sites.')
