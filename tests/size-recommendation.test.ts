import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendSetSize, SIZE_FINDER_CONFIG } from '../shared/sizeRecommendation.ts'

const available = ['M', 'L']

test('specified height and weight examples make conservative decisions', () => {
  const cases = [
    [167, 70, 'recommended', 'M'],
    [170, 85, 'recommended', 'L'],
    [170, 90, 'recommended', 'L'],
    [178, 84, 'recommended', 'L'],
    [185, 80, 'recommended', 'L'],
    [175, 75, 'borderline', null],
    [170, 78, 'borderline', null],
    [160, 90, 'manual', null],
    [185, 65, 'manual', null],
  ] as const
  for (const [height, weight, kind, size] of cases) {
    const result = recommendSetSize(height, weight, available)
    assert.equal(result.kind, kind, `${height} cm / ${weight} kg`)
    if (kind === 'recommended') assert.equal(result.size, size)
  }
})

test('range boundaries, overlap and invalid measurements are explicit', () => {
  assert.deepEqual(recommendSetSize(160, 55, available).kind, 'recommended')
  assert.deepEqual(recommendSetSize(175, 75, available).kind, 'borderline')
  assert.deepEqual(recommendSetSize(170, 75, available).kind, 'borderline')
  assert.deepEqual(recommendSetSize(185, 95, available).kind, 'recommended')
  for (const [height, weight] of [
    [null, 70],
    [170, undefined],
    ['', 70],
    [170, '85'],
    [Number.NaN, 70],
    [119, 70],
    [221, 70],
    [170, 29],
    [170, 201],
  ])
    assert.equal(recommendSetSize(height, weight, available).kind, 'invalid')
})

test('the finder never suggests an unavailable or non-existent size', () => {
  assert.deepEqual(recommendSetSize(167, 70, ['L']), { kind: 'manual', reason: 'unavailable' })
  assert.deepEqual(recommendSetSize(170, 85, ['M']), { kind: 'manual', reason: 'unavailable' })
  assert.deepEqual(recommendSetSize(175, 75, ['M']), { kind: 'manual', reason: 'unavailable' })
  assert.deepEqual(recommendSetSize(170, 85, ['XL', '12']), {
    kind: 'manual',
    reason: 'unavailable',
  })
})

test('tolerances, decision threshold and ranges can be calibrated centrally', () => {
  const config = structuredClone(SIZE_FINDER_CONFIG)
  config.decisionScoreGap = 0.1
  assert.deepEqual(recommendSetSize(170, 78, available, config), { kind: 'recommended', size: 'L' })
  config.sizes.L.minWeight = 90
  assert.equal(recommendSetSize(170, 78, available, config).kind, 'manual')
})
