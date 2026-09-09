import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import type { D1Database, D1Statement } from '../server/utils/d1'

export function testDatabase() {
  const sql = new DatabaseSync(':memory:')
  const directory = new URL('../server/db/migrations/', import.meta.url)
  for (const file of readdirSync(directory)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sql.exec(readFileSync(new URL(file, directory), 'utf8'))
  class Statement implements D1Statement {
    query: string
    values: any[] = []
    constructor(query: string) {
      this.query = query
    }
    bind(...values: any[]) {
      this.values = values
      return this
    }
    async first<T>() {
      const row = sql.prepare(this.query).get(...this.values)
      return row ? ({ ...row } as T) : null
    }
    async all<T>() {
      return {
        success: true,
        results: sql
          .prepare(this.query)
          .all(...this.values)
          .map((row) => ({ ...row })) as T[],
      }
    }
    async run() {
      const result = sql.prepare(this.query).run(...this.values)
      return { success: true, meta: { changes: Number(result.changes) } }
    }
  }
  const database: D1Database = {
    prepare(query) {
      return new Statement(query)
    },
    async batch(statements) {
      sql.exec('BEGIN')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        sql.exec('COMMIT')
        return results
      } catch (error) {
        sql.exec('ROLLBACK')
        throw error
      }
    },
  }
  return { database, sql }
}
