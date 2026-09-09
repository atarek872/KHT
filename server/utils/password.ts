export async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value))
export async function hashPassword(password: string) {
  const iterations = 100000
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return `${iterations}:${encode(salt)}:${encode(new Uint8Array(hash))}`
}
export async function verifyPassword(password: string, encoded: string) {
  try {
    const [iterationText, saltText, expectedText, ...rest] = encoded.split(':')
    const iterations = Number(iterationText)
    if (
      rest.length ||
      !Number.isInteger(iterations) ||
      iterations < 1 ||
      iterations > 1000000 ||
      !saltText ||
      !expectedText
    )
      return false
    const decode = (v: string) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0))
    const salt = decode(saltText)
    const expected = decode(expectedText)
    if (expected.length !== 32) return false
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const actual = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        key,
        256,
      ),
    )
    let difference = 0
    for (let i = 0; i < actual.length; i++) difference |= actual[i]! ^ expected[i]!
    return difference === 0
  } catch {
    return false
  }
}
