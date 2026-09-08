import test from 'node:test'
import assert from 'node:assert/strict'
import { sendPasswordReset } from '../server/services/customerMail.ts'
test('Cloudflare reset delivery uses a fragment token and rejects provider failures', async () => {
  const original = globalThis.fetch
  let payload: any
  globalThis.fetch = (async (_url: any, init: any) => {
    payload = JSON.parse(init.body)
    return new Response(JSON.stringify({ success: true, result: { queued: ['a@example.com'] } }))
  }) as typeof fetch
  try {
    await sendPasswordReset(
      {
        CF_EMAIL_ACCOUNT_ID: 'account',
        CF_EMAIL_TOKEN: 'secret',
        MAIL_FROM: 'store@example.com',
        PUBLIC_SITE_URL: 'https://example.com',
      },
      'a@example.com',
      'opaque-token',
    )
    assert.match(payload.text, /https:\/\/example.com\/account\/reset-password#token=opaque-token/)
    assert.equal(payload.to, 'a@example.com')
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: false }))) as typeof fetch
    await assert.rejects(() =>
      sendPasswordReset(
        {
          CF_EMAIL_ACCOUNT_ID: 'account',
          CF_EMAIL_TOKEN: 'secret',
          MAIL_FROM: 'store@example.com',
          PUBLIC_SITE_URL: 'https://example.com',
        },
        'a@example.com',
        'token',
      ),
    )
  } finally {
    globalThis.fetch = original
  }
})
