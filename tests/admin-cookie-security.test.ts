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
