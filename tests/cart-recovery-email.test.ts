import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { createTestD1 } from './helpers/sqliteD1.ts'
import { saveCartSnapshot } from '../server/services/abandonedCarts.ts'
import {
  captureRecoveryEmails,
  deliverRecoveryEmails,
  getRecoverySelections,
  hasCartRecoveryConsent,
  recoveryMailConfigured,
  setCartRecoveryConsent,
  unsubscribeRecovery,
} from '../server/services/cartRecoveryEmails.ts'

function setup() {
  const fixture = createTestD1()
  const directory = new URL('../server/db/migrations/', import.meta.url)
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort())
    fixture.sqlite.exec(readFileSync(new URL(file, directory), 'utf8'))
  return fixture
}

async function cart(fixture: ReturnType<typeof setup>, suffix: string, ageMinutes: number) {
  const id = `00000000-0000-4000-8000-${suffix}`
  await saveCartSnapshot(fixture.database, {
    cartId: id,
    items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
    contact: { email: `shopper${suffix}@example.com` },
  })
  fixture.sqlite.prepare('UPDATE abandoned_carts SET last_activity=? WHERE id=?')
    .run(new Date(Date.now() - ageMinutes * 60_000).toISOString(), id)
  return id
}

test('only a cart with recorded email consent enters the one-hour sequence', async () => {
  const fixture = setup()
  try {
    const opted = await cart(fixture, '000000000001', 70)
    await cart(fixture, '000000000002', 70)
    await setCartRecoveryConsent(fixture.database, opted, 'shopper000000000001@example.com', true)
    await captureRecoveryEmails(fixture.database)
    const rows = fixture.sqlite.prepare('SELECT cart_id,stage FROM cart_recovery_emails').all() as { cart_id: string; stage: string }[]
    assert.deepEqual(rows.map((row) => ({ ...row })), [{ cart_id: opted, stage: 'hour_1' }])
  } finally { fixture.close() }
})

test('customer opt-in is shown only with a configured marketing sender', () => {
  assert.equal(recoveryMailConfigured({}), false)
  assert.equal(recoveryMailConfigured({
    BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'hello@kht-eg.com', PUBLIC_SITE_URL: 'https://kht-eg.com',
  }), true)
})

test('checkout can read back the current choice for the same cart and email', async () => {
  const fixture = setup()
  try {
    const id = await cart(fixture, '000000000009', 1)
    const email = 'shopper000000000009@example.com'
    assert.equal(await hasCartRecoveryConsent(fixture.database, id, email), false)
    await setCartRecoveryConsent(fixture.database, id, email, true)
    assert.equal(await hasCartRecoveryConsent(fixture.database, id, email), true)
    assert.equal(await hasCartRecoveryConsent(fixture.database, id, 'different@example.com'), false)
    await setCartRecoveryConsent(fixture.database, id, email, false)
    assert.equal(await hasCartRecoveryConsent(fixture.database, id, email), false)
  } finally { fixture.close() }
})

test('one-hour and 24-hour emails differ, and each sends once', async () => {
  const fixture = setup()
  const sent: { subject: string; htmlContent: string; textContent: string }[] = []
  try {
    const id = await cart(fixture, '000000000003', 70)
    await setCartRecoveryConsent(fixture.database, id, 'shopper000000000003@example.com', true)
    await captureRecoveryEmails(fixture.database)
    const config = { BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'hello@kht-eg.com', PUBLIC_SITE_URL: 'https://kht-eg.com' }
    const send = async (_url: string, options: { body: string }) => {
      sent.push(JSON.parse(options.body))
      return { ok: true, json: async () => ({ messageId: 'test' }) }
    }
    await deliverRecoveryEmails(fixture.database, config, send as typeof fetch)
    fixture.sqlite.prepare("UPDATE abandoned_carts SET last_activity=datetime('now','-25 hours') WHERE id=?").run(id)
    fixture.sqlite.prepare("UPDATE abandoned_carts SET marketing_consent_at=datetime('now','-26 hours') WHERE id=?").run(id)
    fixture.sqlite.prepare("UPDATE cart_recovery_emails SET sent_at=datetime('now','-24 hours') WHERE cart_id=? AND stage='hour_1'").run(id)
    await captureRecoveryEmails(fixture.database)
    await deliverRecoveryEmails(fixture.database, config, send as typeof fetch)
    await deliverRecoveryEmails(fixture.database, config, send as typeof fetch)
    assert.equal(sent.length, 2)
    assert.notEqual(sent[0]!.subject, sent[1]!.subject)
    assert.match(sent[0]!.htmlContent, /dir="rtl"/)
    assert.match(sent[0]!.htmlContent, /instagram\.com\/kht\.eg/)
    assert.match(sent[0]!.htmlContent, /\/cart#recovery=/)
    assert.match(sent[0]!.htmlContent, /\/unsubscribe#token=/)
    assert.match(sent[0]!.textContent, /Unsubscribe/)
  } finally { fixture.close() }
})

test('converted or unsubscribed carts never receive the next message', async () => {
  const fixture = setup()
  const sent: unknown[] = []
  try {
    const id = await cart(fixture, '000000000004', 70)
    await setCartRecoveryConsent(fixture.database, id, 'shopper000000000004@example.com', true)
    await captureRecoveryEmails(fixture.database)
    const config = { BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'hello@kht-eg.com', PUBLIC_SITE_URL: 'https://kht-eg.com' }
    const send = async () => { sent.push(1); return { ok: true, json: async () => ({ messageId: 'test' }) } }
    await deliverRecoveryEmails(fixture.database, config, send as typeof fetch)
    const token = (fixture.sqlite.prepare("SELECT token FROM marketing_email_preferences WHERE email='shopper000000000004@example.com'").get() as { token: string }).token
    await unsubscribeRecovery(fixture.database, token)
    assert.equal(await hasCartRecoveryConsent(fixture.database, id, 'shopper000000000004@example.com'), false)
    fixture.sqlite.prepare("UPDATE abandoned_carts SET last_activity=datetime('now','-25 hours') WHERE id=?").run(id)
    await captureRecoveryEmails(fixture.database)
    await deliverRecoveryEmails(fixture.database, config, send as typeof fetch)
    assert.equal(sent.length, 1)
  } finally { fixture.close() }
})

test('purchase after queueing suppresses the reminder', async () => {
  const fixture = setup()
  const sent: unknown[] = []
  try {
    const id = await cart(fixture, '000000000007', 70)
    await setCartRecoveryConsent(fixture.database, id, 'shopper000000000007@example.com', true)
    await captureRecoveryEmails(fixture.database)
    fixture.sqlite.prepare("UPDATE abandoned_carts SET state='converted' WHERE id=?").run(id)
    await deliverRecoveryEmails(fixture.database, {
      BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'hello@kht-eg.com', PUBLIC_SITE_URL: 'https://kht-eg.com',
    }, (async () => { sent.push(1); return { ok: true } }) as typeof fetch)
    assert.equal(sent.length, 0)
    assert.equal((fixture.sqlite.prepare("SELECT state FROM cart_recovery_emails WHERE cart_id=? AND stage='hour_1'").get(id) as { state: string }).state, 'skipped')
  } finally { fixture.close() }
})

test('mail provider failure retries without leaking its response or the customer email', async () => {
  const fixture = setup()
  const warnings: string[] = []
  const originalWarn = console.warn
  try {
    const id = await cart(fixture, '000000000008', 70)
    await setCartRecoveryConsent(fixture.database, id, 'shopper000000000008@example.com', true)
    await captureRecoveryEmails(fixture.database)
    console.warn = (...values) => warnings.push(JSON.stringify(values))
    const result = await deliverRecoveryEmails(fixture.database, {
      BREVO_API_KEY: 'secret-api-key', BREVO_SENDER_EMAIL: 'hello@kht-eg.com', PUBLIC_SITE_URL: 'https://kht-eg.com',
    }, (async () => { throw new Error('secret provider response') }) as typeof fetch)
    assert.equal(result.retried, 1)
    assert.equal((fixture.sqlite.prepare("SELECT state FROM cart_recovery_emails WHERE cart_id=? AND stage='hour_1'").get(id) as { state: string }).state, 'pending')
    assert.doesNotMatch(warnings.join(' '), /shopper000000000008|secret-api-key|secret provider response/)
  } finally { console.warn = originalWarn; fixture.close() }
})

test('mail provider must acknowledge a message before it is marked sent', async () => {
  const fixture = setup()
  try {
    const id = await cart(fixture, '000000000010', 70)
    await setCartRecoveryConsent(fixture.database, id, 'shopper000000000010@example.com', true)
    await captureRecoveryEmails(fixture.database)
    await deliverRecoveryEmails(fixture.database, {
      BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'hello@kht-eg.com', PUBLIC_SITE_URL: 'https://kht-eg.com',
    }, (async () => ({ ok: true, json: async () => ({}) })) as typeof fetch)
    assert.equal((fixture.sqlite.prepare("SELECT state FROM cart_recovery_emails WHERE cart_id=? AND stage='hour_1'").get(id) as { state: string }).state, 'pending')
  } finally { fixture.close() }
})

test('older consenting cart gets its first reminder now and second only a day later', async () => {
  const fixture = setup()
  try {
    const id = await cart(fixture, '000000000005', 48 * 60)
    await setCartRecoveryConsent(fixture.database, id, 'shopper000000000005@example.com', true)
    await captureRecoveryEmails(fixture.database)
    assert.equal((fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM cart_recovery_emails WHERE cart_id=?').get(id) as { n: number }).n, 1)
    fixture.sqlite.prepare("UPDATE cart_recovery_emails SET state='sent',sent_at=datetime('now') WHERE cart_id=? AND stage='hour_1'").run(id)
    await captureRecoveryEmails(fixture.database)
    assert.equal((fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM cart_recovery_emails WHERE cart_id=?').get(id) as { n: number }).n, 1)
    fixture.sqlite.prepare("UPDATE cart_recovery_emails SET sent_at=datetime('now','-24 hours') WHERE cart_id=? AND stage='hour_1'").run(id)
    await captureRecoveryEmails(fixture.database)
    assert.equal((fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM cart_recovery_emails WHERE cart_id=?').get(id) as { n: number }).n, 2)
  } finally { fixture.close() }
})

test('recovery token exposes product selections only while the bag remains active', async () => {
  const fixture = setup()
  try {
    const id = await cart(fixture, '000000000006', 70)
    await setCartRecoveryConsent(fixture.database, id, 'shopper000000000006@example.com', true)
    const token = (fixture.sqlite.prepare('SELECT recovery_token AS token FROM abandoned_carts WHERE id=?').get(id) as { token: string }).token
    assert.deepEqual(await getRecoverySelections(fixture.database, token), [{ id: 'kht-001', size: 'M', quantity: 1 }])
    fixture.sqlite.prepare("UPDATE abandoned_carts SET recovery_token_expires_at=datetime('now','-1 minute') WHERE id=?").run(id)
    assert.equal(await getRecoverySelections(fixture.database, token), null)
    fixture.sqlite.prepare("UPDATE abandoned_carts SET recovery_token_expires_at=datetime('now','+1 day') WHERE id=?").run(id)
    fixture.sqlite.prepare("UPDATE abandoned_carts SET state='converted' WHERE id=?").run(id)
    assert.equal(await getRecoverySelections(fixture.database, token), null)
  } finally { fixture.close() }
})
