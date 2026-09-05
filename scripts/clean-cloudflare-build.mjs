import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const project = resolve(import.meta.dirname, '..')
const staging = join(project, 'dist')

if (existsSync(staging)) {
  if (
    lstatSync(staging).isSymbolicLink()
    || realpathSync(staging) !== join(realpathSync(project), 'dist')
  ) throw new Error('The build staging directory must be inside this project.')
  rmSync(staging, { recursive: true })
}
