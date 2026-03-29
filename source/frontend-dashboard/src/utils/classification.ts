import type { EventClassification } from '../types/seismic'

export const CLASSIFICATION_BANDS = {
  EARTHQUAKE: { min: 0.5, max: 3.0 },
  CONVENTIONAL_EXPLOSION: { min: 3.0, max: 8.0 },
  NUCLEAR_LIKE: { min: 8.0, max: Number.POSITIVE_INFINITY },
} as const

export const classifyByFrequency = (frequency: number): EventClassification => {
  if (frequency >= CLASSIFICATION_BANDS.EARTHQUAKE.min && frequency < CLASSIFICATION_BANDS.EARTHQUAKE.max) {
    return 'EARTHQUAKE'
  }

  if (
    frequency >= CLASSIFICATION_BANDS.CONVENTIONAL_EXPLOSION.min &&
    frequency < CLASSIFICATION_BANDS.CONVENTIONAL_EXPLOSION.max
  ) {
    return 'CONVENTIONAL_EXPLOSION'
  }

  return 'NUCLEAR_LIKE'
}

export const classificationLabel: Record<EventClassification, string> = {
  EARTHQUAKE: 'Earthquake',
  CONVENTIONAL_EXPLOSION: 'Conventional Explosion',
  NUCLEAR_LIKE: 'Nuclear-like Event',
}

export const classificationBadgeClass: Record<EventClassification, string> = {
  EARTHQUAKE: 'text-sky-100 border-sky-200/35 bg-sky-300/12',
  CONVENTIONAL_EXPLOSION: 'text-teal-100 border-teal-200/35 bg-teal-300/12',
  NUCLEAR_LIKE: 'text-indigo-100 border-indigo-200/35 bg-indigo-300/12',
}
