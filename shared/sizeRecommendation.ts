export type KhtSetSize = 'M' | 'L'

export interface SizeFinderConfig {
  supportedHeight: { min: number; max: number }
  supportedWeight: { min: number; max: number }
  heightToleranceCm: number
  weightToleranceKg: number
  decisionScoreGap: number
  sizes: Record<
    KhtSetSize,
    {
      minHeight: number
      maxHeight: number
      minWeight: number
      maxWeight: number
      garment: {
        hoodieFlatWidthCm: number
        hoodieLengthCm: number
        pantsLengthCm: number
        listedPantsWaistCircumferenceCm: number
      }
    }
  >
}

// Initial fit ranges and tolerances are estimates, not customer fitting-study results.
// Garment figures are measured on the pieces, not on the customer's body.
export const SIZE_FINDER_CONFIG: SizeFinderConfig = {
  supportedHeight: { min: 120, max: 220 },
  supportedWeight: { min: 30, max: 200 },
  heightToleranceCm: 5,
  weightToleranceKg: 8,
  decisionScoreGap: 0.35,
  sizes: {
    M: {
      minHeight: 160,
      maxHeight: 175,
      minWeight: 55,
      maxWeight: 75,
      garment: {
        hoodieFlatWidthCm: 67,
        hoodieLengthCm: 72,
        pantsLengthCm: 100,
        listedPantsWaistCircumferenceCm: 104,
      },
    },
    L: {
      minHeight: 170,
      maxHeight: 185,
      minWeight: 75,
      maxWeight: 95,
      garment: {
        hoodieFlatWidthCm: 72,
        hoodieLengthCm: 76,
        pantsLengthCm: 100,
        listedPantsWaistCircumferenceCm: 112,
      },
    },
  },
}

export type SizeFinderResult =
  | { kind: 'invalid' }
  | { kind: 'manual'; reason: 'outside-ranges' | 'unavailable' }
  | { kind: 'borderline'; sizes: KhtSetSize[] }
  | { kind: 'recommended'; size: KhtSetSize }

function outsideDistance(value: number, minimum: number, maximum: number) {
  return Math.max(minimum - value, 0, value - maximum)
}

export function recommendSetSize(
  height: unknown,
  weight: unknown,
  availableSizes: readonly string[],
  config: SizeFinderConfig = SIZE_FINDER_CONFIG,
): SizeFinderResult {
  if (
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    typeof weight !== 'number' ||
    !Number.isFinite(weight) ||
    height < config.supportedHeight.min ||
    height > config.supportedHeight.max ||
    weight < config.supportedWeight.min ||
    weight > config.supportedWeight.max
  )
    return { kind: 'invalid' }

  const score = (size: KhtSetSize) => {
    const range = config.sizes[size]
    const heightDistance = outsideDistance(height, range.minHeight, range.maxHeight)
    const weightDistance = outsideDistance(weight, range.minWeight, range.maxWeight)
    return (
      (heightDistance / config.heightToleranceCm) ** 2 +
      (weightDistance / config.weightToleranceKg) ** 2
    )
  }
  const m = score('M')
  const l = score('L')
  const inM = m === 0
  const inL = l === 0
  if (!inM && !inL) return { kind: 'manual', reason: 'outside-ranges' }
  if ((inM && inL) || Math.abs(m - l) <= config.decisionScoreGap) {
    return availableSizes.includes('M') && availableSizes.includes('L')
      ? { kind: 'borderline', sizes: ['M', 'L'] }
      : { kind: 'manual', reason: 'unavailable' }
  }
  const size: KhtSetSize = inM ? 'M' : 'L'
  return availableSizes.includes(size)
    ? { kind: 'recommended', size }
    : { kind: 'manual', reason: 'unavailable' }
}
