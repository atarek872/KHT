export function sendOnce(
  key: string,
  send: () => boolean,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
) {
  try {
    if (storage?.getItem(key)) return false
  } catch {
    // Analytics remains available when session storage is blocked.
  }
  const sent = send()
  if (sent) {
    try {
      storage?.setItem(key, '1')
    } catch {
      /* Storage may be unavailable. */
    }
  }
  return sent
}
