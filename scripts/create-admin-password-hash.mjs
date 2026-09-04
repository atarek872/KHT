import { pbkdf2Sync, randomBytes } from 'node:crypto'

const password = process.argv[2]
if (!password) {
  console.error('Usage: npm run admin:hash-password -- "your password"')
  process.exit(1)
}
const iterations = 210000
const salt = randomBytes(16)
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
console.log(`${iterations}:${salt.toString('base64')}:${hash.toString('base64')}`)