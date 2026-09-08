import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
  readdirSync,
  readFileSync,
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
// Keep the existing SQL migrations as the single source of truth. Sites consumes
// the same ordered migrations through its Drizzle-compatible deployment journal.
const migrationDirectory = join(staging, '.openai/drizzle')
mkdirSync(join(migrationDirectory, 'meta'), { recursive: true })
const migrations = readdirSync(join(project, 'server/db/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort()
function drizzleStatements(sql) {
  const statements = []
  let current = []
  let trigger = false
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim().toUpperCase()
    if (trimmed.startsWith('CREATE TRIGGER ')) trigger = true
    current.push(line)
    if ((!trigger && trimmed.endsWith(';')) || (trigger && line === 'END;')) {
      statements.push(current.join('\n').trim())
      current = []
      trigger = false
    }
  }
  if (current.join('').trim()) throw new Error('Incomplete SQL migration statement.')
  return statements.join('\n--> statement-breakpoint\n') + '\n'
}
for (const name of migrations) {
  const sql = readFileSync(join(project, 'server/db/migrations', name), 'utf8')
  writeFileSync(join(migrationDirectory, name), drizzleStatements(sql))
}
writeFileSync(
  join(migrationDirectory, 'meta/_journal.json'),
  JSON.stringify(
    {
      version: '7',
      dialect: 'sqlite',
      entries: migrations.map((name, idx) => ({
        idx,
        version: '6',
        when: 1788480000000 + idx * 1000,
        tag: name.slice(0, -4),
        breakpoints: true,
      })),
    },
    null,
    2,
  ),
)
writeFileSync(join(staging, 'server/index.js'), "export { default } from './index.mjs';\n")
console.log('Nuxt Cloudflare worker and public assets staged for Sites.')
