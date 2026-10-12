import assert from 'node:assert/strict'
import test from 'node:test'
import { invalidCheckoutFields, normalizeCheckoutPhone } from '../shared/checkoutSteps.ts'

const draft = () => ({
  name: 'Ahmed Tarek',
  email: '',
  phone: '+201012345678',
  governorate: 'Cairo',
  city: 'Nasr City',
  address: '12 Example Street',
})

test('contact step requires a usable name and phone while email stays optional', () => {
  assert.deepEqual(invalidCheckoutFields(1, draft(), ['Cairo']), [])
  assert.deepEqual(
    invalidCheckoutFields(1, { ...draft(), name: ' ', phone: '123', email: 'invalid' }, ['Cairo']),
    ['name', 'phone', 'email'],
  )
})

test('delivery step requires an enabled shipping zone and complete address', () => {
  assert.deepEqual(invalidCheckoutFields(2, draft(), ['Cairo']), [])
  assert.deepEqual(
    invalidCheckoutFields(2, { ...draft(), governorate: 'Giza', city: ' ', address: '' }, [
      'Cairo',
    ]),
    ['governorate', 'city', 'address'],
  )
  assert.deepEqual(invalidCheckoutFields(2, { ...draft(), governorate: '' }, ['Cairo']), [
    'governorate',
  ])
})

test('checkout accepts Egyptian mobile formats and normalizes Arabic digits for both order APIs', () => {
  assert.equal(normalizeCheckoutPhone('01012345678'), '201012345678')
  assert.equal(normalizeCheckoutPhone('+20 101 234 5678'), '201012345678')
  assert.equal(normalizeCheckoutPhone('٠١٠١٢٣٤٥٦٧٨'), '201012345678')
  assert.equal(normalizeCheckoutPhone('1234567890'), null)
  assert.deepEqual(invalidCheckoutFields(1, { ...draft(), phone: '1234567890' }, ['Cairo']), [
    'phone',
  ])
})
