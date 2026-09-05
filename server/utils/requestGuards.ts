type RequestEvent = Parameters<typeof getHeader>[0]

function requestIdentifier(event: RequestEvent) {
  const context = event.context as Record<string, unknown>
  if (typeof context.requestId !== 'string') context.requestId = crypto.randomUUID()
  const requestId = context.requestId as string
  setResponseHeader(event, 'X-Request-Id', requestId)
  return requestId
}

export async function requireJsonBody<T>(event: RequestEvent, maxBytes = 32_768): Promise<T> {
  requestIdentifier(event)
  const contentType = getHeader(event, 'content-type') || ''
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw createError({ statusCode: 415, statusMessage: 'Content-Type must be application/json.' })
  }

  const contentLengthText = getHeader(event, 'content-length')
  if (contentLengthText) {
    const contentLength = Number(contentLengthText)
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid Content-Length header.' })
    }
    if (contentLength > maxBytes) {
      throw createError({ statusCode: 413, statusMessage: 'Payload is too large.' })
    }
  }

  const rawBody = (await readRawBody(event)) || ''
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    throw createError({ statusCode: 413, statusMessage: 'Payload is too large.' })
  }
  if (!rawBody.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'A JSON body is required.' })
  }
  try {
    return JSON.parse(rawBody) as T
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'The JSON body is invalid.' })
  }
}

export function requireSameOrigin(event: RequestEvent) {
  requestIdentifier(event)
  const origin = getHeader(event, 'origin')
  if (!origin) return
  const expectedOrigin = getRequestURL(event).origin
  if (origin !== expectedOrigin) {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin mutation rejected.' })
  }
}

export function safeErrorMessage(error: unknown, allowed: readonly RegExp[], fallback: string) {
  const message = error instanceof Error ? error.message : ''
  if (message.length <= 240 && allowed.some((pattern) => pattern.test(message))) return message
  return fallback
}
