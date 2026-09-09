import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { hashPassword, verifyPassword, digest } from '../server/utils/password.ts'
import {
  normalizeEmail,
  validatePassword,
  resetCustomerPassword,
} from '../server/services/customerAccounts.ts'

test('password hashes are salted and verify safely', async () => {
  const a = await hashPassword('correct horse battery')
  const b = await hashPassword('correct horse battery')
  assert.notEqual(a, b)
  assert.equal(await verifyPassword('correct horse battery', a), true)
  assert.equal(await verifyPassword('wrong', a), false)
  assert.equal(await verifyPassword('wrong', 'broken'), false)
})
test('email and password inputs are bounded', () => {
  assert.equal(normalizeEmail(' Alice@Example.com '), 'alice@example.com')
  assert.throws(() => normalizeEmail('not-email'))
  assert.throws(() => validatePassword('short'))
  assert.throws(() => validatePassword('a'.repeat(129)))
  assert.equal(validatePassword('a'.repeat(12)), 'a'.repeat(12))
})
test('reset tokens are single use, expire, and revoke all sessions atomically', async () => {
  const sql = new DatabaseSync(':memory:')
  sql.exec(
    readFileSync(
      new URL('../server/db/migrations/0007_customer_identity.sql', import.meta.url),
      'utf8',
    ),
  )
  const wrap = (q: string, values: unknown[] = []): any => ({
    bind: (...v: unknown[]) => wrap(q, v),
    first: async () => sql.prepare(q).get(...(values as any[])) || null,
    run: async () => ({
      success: true,
      meta: { changes: Number(sql.prepare(q).run(...(values as any[])).changes) },
    }),
  })
  const db: any = {
    prepare: wrap,
    batch: async (statements: any[]) => {
      sql.exec('BEGIN')
      try {
        const out = []
        for (const s of statements) out.push(await s.run())
        sql.exec('COMMIT')
        return out
      } catch (e) {
        sql.exec('ROLLBACK')
        throw e
      }
    },
  }
  sql
    .prepare('INSERT INTO customer_users(id,name,email,password_hash) VALUES(?,?,?,?)')
    .run('u', 'User', 'u@example.com', 'old')
  sql
    .prepare('INSERT INTO customer_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .run('session', 'u', '2099-01-01')
  sql
    .prepare('INSERT INTO customer_password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .run(await digest('secret'), 'u', '2099-01-01')
  assert.equal(await resetCustomerPassword(db, 'secret', 'new secure password'), true)
  assert.equal(await resetCustomerPassword(db, 'secret', 'another secure password'), false)
  assert.equal((sql.prepare('SELECT count(*) AS n FROM customer_sessions').get() as any).n, 0)
  assert.equal(
    await verifyPassword(
      'new secure password',
      (sql.prepare('SELECT password_hash FROM customer_users').get() as any).password_hash,
    ),
    true,
  )
  sql
    .prepare('INSERT INTO customer_password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)')
    .run(await digest('expired'), 'u', '2000-01-01')
  assert.equal(await resetCustomerPassword(db, 'expired', 'another secure password'), false)
  sql.close()
})
