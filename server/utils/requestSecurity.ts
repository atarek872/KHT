export function isSecureRequest(url: URL) {
  return url.protocol === 'https:'
}
