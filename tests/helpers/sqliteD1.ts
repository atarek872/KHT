import { DatabaseSync } from 'node:sqlite'
import type { D1Database, D1Statement } from '../../server/utils/d1.ts'

export function createTestD1() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')

  const database: D1Database = {
    prepare(sql) {
      let values: unknown[] = []
      const statement: D1Statement = {
        bind(...next) {
          values = next
          return statement
        },
        async first<T>() {
          const row = sqlite.prepare(sql).get(...values)
          return row ? ({ ...row } as T) : null
        },
        async all<T>() {
          const rows = sqlite.prepare(sql).all(...values)
          return {
            success: true,
            results: rows.map((row) => ({ ...row })) as T[],
          }
        },
        async run() {
          const result = sqlite.prepare(sql).run(...values)
          return {
            success: true,
            meta: { changes: Number(result.changes) },
          }
        },
      }
      return statement
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE')
      try {
        const results = []
        for (const statement of statements) results.push(await statement.run())
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
  }

  return {
    database,
    sqlite,
    close: () => sqlite.close(),
  }
}
