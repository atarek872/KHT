export function isSecureRequest(url: URL) {
  return url.protocol === 'https:'
}

export function isTrustedRequestOrigin(origin: string | undefined, requestUrl: URL) {
  return Boolean(origin) && origin === requestUrl.origin
}
