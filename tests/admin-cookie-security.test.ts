import assert from 'node:assert/strict'
import test from 'node:test'

test('admin session cookies stay secure on HTTPS and work on local HTTP', async () => {
  let security: typeof import('../server/utils/requestSecurity.ts')
  try {
    security = await import('../server/utils/requestSecurity.ts')
  } catch {
    assert.fail('The request security helper is missing')
  }

  assert.equal(security.isSecureRequest(new URL('https://shop.example.com/admin/login')), true)
  assert.equal(security.isSecureRequest(new URL('http://127.0.0.1:8787/admin/login')), false)
  assert.equal(security.isSecureRequest(new URL('http://localhost:8787/admin/login')), false)
})

test('privileged mutations require an exact request origin', async () => {
  const security = await import('../server/utils/requestSecurity.ts')
  const requestUrl = new URL('https://shop.example.com/api/admin/products')

  assert.equal(security.isTrustedRequestOrigin(undefined, requestUrl), false)
  assert.equal(security.isTrustedRequestOrigin('https://evil.example', requestUrl), false)
  assert.equal(
    security.isTrustedRequestOrigin('https://shop.example.com.evil.test', requestUrl),
    false,
  )
  assert.equal(security.isTrustedRequestOrigin('https://shop.example.com', requestUrl), true)
})
