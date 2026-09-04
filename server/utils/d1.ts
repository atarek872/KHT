interface D1Result<T = unknown> {
  results?: T[]
  success: boolean
  meta?: { changes?: number }
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}

export interface D1Database {
  prepare(query: string): D1Statement
  batch<T = unknown>(statements: D1Statement[]): Promise<D1Result<T>[]>
}

export function getDatabase(event: { context: Record<string, unknown> }): D1Database | undefined {
  const cloudflare = event.context.cloudflare as { env?: { DB?: D1Database } } | undefined
  return cloudflare?.env?.DB
}

export function requireDatabase(event: { context: Record<string, unknown> }): D1Database {
  const database = getDatabase(event)
  if (!database) {
    throw createError({ statusCode: 503, statusMessage: 'Commerce database is not configured.' })
  }
  return database
}

export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; etag?: string } | null>
  delete(key: string): Promise<void>
}

export function getProductMedia(event: { context: Record<string, unknown> }): R2Bucket | undefined {
  const cloudflare = event.context.cloudflare as { env?: { PRODUCT_MEDIA?: R2Bucket } } | undefined
  return cloudflare?.env?.PRODUCT_MEDIA
}