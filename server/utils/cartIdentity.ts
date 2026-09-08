import type { H3Event } from 'h3'
import { getCookie, setCookie, getRequestURL } from 'h3'

export async function guestCartHash(event: H3Event) {
  let token = getCookie(event, 'kht-guest-cart')
  if (!token || !/^[a-f0-9-]{72}$/.test(token)) {
    token = crypto.randomUUID() + crypto.randomUUID()
    setCookie(event, 'kht-guest-cart', token, {
      httpOnly: true,
      secure: getRequestURL(event).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 2592000,
    })
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
