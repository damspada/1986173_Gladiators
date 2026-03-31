import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALERT_PREFERENCES,
  ALERT_SETTINGS_STORAGE_KEY,
  evaluateAlertSeverity,
  normalizeAlertPreferences,
  readAlertPreferences,
  saveAlertPreferences,
  shouldTriggerAlert,
} from './alerting'

describe('evaluateAlertSeverity', () => {
  it('maps frequencies to the expected level', () => {
    const thresholds = {
      low: 1.2,
      medium: 2.5,
      high: 5,
      critical: 8,
    }

    expect(evaluateAlertSeverity(0.9, thresholds)).toBeNull()
    expect(evaluateAlertSeverity(1.2, thresholds)).toBe('low')
    expect(evaluateAlertSeverity(2.5, thresholds)).toBe('medium')
    expect(evaluateAlertSeverity(5, thresholds)).toBe('high')
    expect(evaluateAlertSeverity(8, thresholds)).toBe('critical')
  })
})

describe('shouldTriggerAlert', () => {
  it('triggers on severity changes', () => {
    const decision = shouldTriggerAlert({
      previousSeverity: 'low',
      nextSeverity: 'high',
      lastTriggeredAtMs: 200,
      nowMs: 220,
      cooldownMs: 5000,
      reAlertOnStable: true,
    })

    expect(decision).toBe(true)
  })

  it('respects cooldown for stable severity', () => {
    const beforeCooldown = shouldTriggerAlert({
      previousSeverity: 'high',
      nextSeverity: 'high',
      lastTriggeredAtMs: 1000,
      nowMs: 1500,
      cooldownMs: 2000,
      reAlertOnStable: true,
    })

    const afterCooldown = shouldTriggerAlert({
      previousSeverity: 'high',
      nextSeverity: 'high',
      lastTriggeredAtMs: 1000,
      nowMs: 3200,
      cooldownMs: 2000,
      reAlertOnStable: true,
    })

    expect(beforeCooldown).toBe(false)
    expect(afterCooldown).toBe(true)
  })

  it('does not re-alert when stable re-alert is disabled', () => {
    const decision = shouldTriggerAlert({
      previousSeverity: 'medium',
      nextSeverity: 'medium',
      lastTriggeredAtMs: 1000,
      nowMs: 9000,
      cooldownMs: 2000,
      reAlertOnStable: false,
    })

    expect(decision).toBe(false)
  })
})

describe('alert settings persistence', () => {
  it('normalizes invalid settings and persists valid values', () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
    }

    const normalized = normalizeAlertPreferences({
      thresholds: {
        low: Number.NaN,
        medium: 1,
        high: -3,
        critical: 2,
      },
      visualEnabled: false,
      audioEnabled: true,
      cooldownMs: -100,
    })

    saveAlertPreferences(normalized, storage)

    const restored = readAlertPreferences(storage)

    expect(DEFAULT_ALERT_PREFERENCES.visualEnabled).toBe(false)
    expect(DEFAULT_ALERT_PREFERENCES.audioEnabled).toBe(false)
    expect(restored.visualEnabled).toBe(false)
    expect(restored.audioEnabled).toBe(true)
    expect(restored.cooldownMs).toBeGreaterThanOrEqual(1000)
    expect(restored.visualDurationMs).toBeGreaterThanOrEqual(1200)
    expect(restored.audioVolume).toBeGreaterThanOrEqual(0)
    expect(restored.audioVolume).toBeLessThanOrEqual(100)
    expect(restored.thresholds.low).toBe(DEFAULT_ALERT_PREFERENCES.thresholds.low)
    expect(restored.thresholds.medium).toBeGreaterThan(restored.thresholds.low)
    expect(restored.thresholds.high).toBeGreaterThan(restored.thresholds.medium)
    expect(restored.thresholds.critical).toBeGreaterThan(restored.thresholds.high)
    expect(memory.has(ALERT_SETTINGS_STORAGE_KEY)).toBe(true)
  })
})
