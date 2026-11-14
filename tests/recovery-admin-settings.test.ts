import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { createTestD1 } from './helpers/sqliteD1.ts'
import { saveCartSnapshot } from '../server/services/abandonedCarts.ts'
import { deliverRecoveryEmails } from '../server/services/cartRecoveryEmails.ts'
import {
  decryptRecoveryKey,
  encryptRecoveryKey,
  getRecoveryAdminSettings,
  loadRecoveryMailConfig,
  queueManualRecovery,
  saveRecoveryAdminSettings,
} from '../server/services/recoveryAdminSettings.ts'

const masterKey = Buffer.alloc(32, 7).toString('base64')

function setup() {
  const fixture = createTestD1()
  const directory = new URL('../server/db/migrations/', import.meta.url)
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort())
    fixture.sqlite.exec(readFileSync(new URL(file, directory), 'utf8'))
  return fixture
}

test('Brevo API key is encrypted at rest and never returned by admin settings', async () => {
  const fixture = setup()
  try {
    const cipher = await encryptRecoveryKey('xkeysib-private-test-value', masterKey)
    assert.doesNotMatch(cipher, /xkeysib-private-test-value/)
    assert.equal(await decryptRecoveryKey(cipher, masterKey), 'xkeysib-private-test-value')
    await assert.rejects(() => decryptRecoveryKey(cipher, Buffer.alloc(32, 8).toString('base64')))
    await saveRecoveryAdminSettings(fixture.database, masterKey, {
      senderEmail: 'hello@kht-eg.com',
      apiKey: 'xkeysib-private-test-value',
      enabled: false,
      firstDelayMinutes: 60,
      secondDelayHours: 24,
    })
    const settings = await getRecoveryAdminSettings(fixture.database)
    assert.equal(settings.hasApiKey, true)
    assert.equal(settings.enabled, false)
    assert.doesNotMatch(JSON.stringify(settings), /xkeysib-private-test-value/)
    assert.doesNotMatch(
      JSON.stringify(fixture.sqlite.prepare('SELECT * FROM cart_recovery_settings').get()),
      /xkeysib-private-test-value/,
    )
    assert.equal(
      (await loadRecoveryMailConfig(fixture.database, masterKey, true)).BREVO_API_KEY,
      'xkeysib-private-test-value',
    )
  } finally {
    fixture.close()
  }
})

test('manual recovery needs recorded permission and can be queued only once', async () => {
  const fixture = setup()
  try {
    const id = '00000000-0000-4000-8000-000000000011'
    await saveCartSnapshot(fixture.database, {
      cartId: id,
      items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
      contact: { email: 'shopper@example.com' },
    })
    fixture.sqlite
      .prepare("UPDATE abandoned_carts SET last_activity=datetime('now','-70 minutes') WHERE id=?")
      .run(id)
    await assert.rejects(
      () => queueManualRecovery(fixture.database, id, 'owner@example.com'),
      /CONSENT_REQUIRED/,
    )
    const queued = await queueManualRecovery(
      fixture.database,
      id,
      'owner@example.com',
      'Customer consented in Instagram DM on 14 Nov',
    )
    assert.equal(queued.queued, true)
    assert.equal(
      (
        fixture.sqlite
          .prepare('SELECT marketing_consent_source AS source FROM abandoned_carts WHERE id=?')
          .get(id) as { source: string }
      ).source,
      'Customer consented in Instagram DM on 14 Nov',
    )
    await assert.rejects(
      () => queueManualRecovery(fixture.database, id, 'owner@example.com'),
      /ALREADY_QUEUED/,
    )
  } finally {
    fixture.close()
  }
})

test('manual recovery refuses an unsubscribed or converted cart', async () => {
  const fixture = setup()
  try {
    const id = '00000000-0000-4000-8000-000000000012'
    await saveCartSnapshot(fixture.database, {
      cartId: id,
      items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
      contact: { email: 'shopper2@example.com' },
    })
    fixture.sqlite
      .prepare(
        "INSERT INTO marketing_email_preferences(email,token,unsubscribed_at) VALUES('shopper2@example.com','token',datetime('now'))",
      )
      .run()
    await assert.rejects(
      () =>
        queueManualRecovery(fixture.database, id, 'owner@example.com', 'Consent saved externally'),
      /UNSUBSCRIBED/,
    )
    fixture.sqlite.prepare('UPDATE marketing_email_preferences SET unsubscribed_at=NULL').run()
    fixture.sqlite.prepare("UPDATE abandoned_carts SET state='converted' WHERE id=?").run(id)
    await assert.rejects(
      () =>
        queueManualRecovery(fixture.database, id, 'owner@example.com', 'Consent saved externally'),
      /NOT_ACTIVE/,
    )
  } finally {
    fixture.close()
  }
})

test('manual send delivers once immediately and keeps a retry record on provider failure', async () => {
  const fixture = setup()
  try {
    const id = '00000000-0000-4000-8000-000000000013'
    await saveCartSnapshot(fixture.database, {
      cartId: id,
      items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
      contact: { email: 'quick@example.com' },
    })
    await queueManualRecovery(
      fixture.database,
      id,
      'owner@example.com',
      'Customer opted in via Instagram DM on 14 Nov',
    )
    const config = {
      BREVO_API_KEY: 'test-key',
      BREVO_SENDER_EMAIL: 'hello@kht-eg.com',
      PUBLIC_SITE_URL: 'https://kht-eg.com',
    }
    let calls = 0
    const send = async () => {
      calls++
      return { ok: true, json: async () => ({ messageId: 'accepted' }) }
    }
    assert.deepEqual(
      await deliverRecoveryEmails(fixture.database, config, send as typeof fetch, 1, id),
      { sent: 1, retried: 0 },
    )
    await deliverRecoveryEmails(fixture.database, config, send as typeof fetch, 1, id)
    assert.equal(calls, 1)
    const failedId = '00000000-0000-4000-8000-000000000014'
    await saveCartSnapshot(fixture.database, {
      cartId: failedId,
      items: [{ id: 'kht-001', size: 'M', quantity: 1 }],
      contact: { email: 'retry@example.com' },
    })
    await queueManualRecovery(
      fixture.database,
      failedId,
      'owner@example.com',
      'Customer opted in via Instagram DM on 14 Nov',
    )
    const failed = await deliverRecoveryEmails(
      fixture.database,
      config,
      (async () => ({ ok: false })) as typeof fetch,
      1,
      failedId,
    )
    assert.deepEqual(failed, { sent: 0, retried: 1 })
    assert.equal(
      (
        fixture.sqlite
          .prepare("SELECT state FROM cart_recovery_emails WHERE cart_id=? AND stage='hour_1'")
          .get(failedId) as { state: string }
      ).state,
      'pending',
    )
  } finally {
    fixture.close()
  }
})
