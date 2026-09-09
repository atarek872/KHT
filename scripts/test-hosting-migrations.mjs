import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'

const directory = new URL('../dist/.openai/drizzle/', import.meta.url)
const database = new DatabaseSync(':memory:')
for (const file of readdirSync(directory)
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  const sql = readFileSync(new URL(file, directory), 'utf8')
  assert.equal(sql.includes('\r'), false, `${file} must use LF line endings for remote D1`)
  assert.equal(
    /SELECT\s+CASE\b/i.test(sql),
    false,
    `${file} must parenthesize CASE expressions inside triggers for remote D1`,
  )
  const statements = sql.split(
    '--> statement-breakpoint',
  )
  assert.ok(statements.length > 1, `${file} must contain explicit statement boundaries`)
  for (const [index, statement] of statements.entries()) {
    if (!statement.trim()) continue
    try {
      database.exec(statement)
    } catch (error) {
      throw new Error(`${file} statement ${index + 1}: ${error.message}\n${statement}`)
    }
  }
}
assert.ok(database.prepare("SELECT 1 FROM sqlite_schema WHERE name='customer_users'").get())
assert.ok(database.prepare("SELECT 1 FROM sqlite_schema WHERE name='order_status_history'").get())
console.log('Sites migration package passed with explicit statement boundaries.')
