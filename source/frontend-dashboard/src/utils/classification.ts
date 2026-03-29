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
  EARTHQUAKE: 'text-cyan-300 border-cyan-500/50 bg-cyan-500/10',
  CONVENTIONAL_EXPLOSION: 'text-amber-300 border-amber-500/50 bg-amber-500/10',
  NUCLEAR_LIKE: 'text-rose-300 border-rose-600/50 bg-rose-600/10',
}

export const classificationBandPalette: Record<EventClassification, string> = {
  EARTHQUAKE: 'rgba(34,211,238,0.08)',
  CONVENTIONAL_EXPLOSION: 'rgba(245,158,11,0.08)',
  NUCLEAR_LIKE: 'rgba(225,29,72,0.1)',
}

export const isSevereAnomaly = (frequency: number, severity?: 'normal' | 'warning' | 'critical'): boolean => {
  if (severity === 'critical') {
    return true
  }

  return frequency >= 8.8
}
