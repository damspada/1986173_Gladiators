export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AlertThresholds {
  low: number
  medium: number
  high: number
  critical: number
}

export interface AlertPreferences {
  thresholds: AlertThresholds
  visualEnabled: boolean
  audioEnabled: boolean
  cooldownMs: number
  reAlertOnStable: boolean
  visualMinSeverity: AlertSeverity
  audioMinSeverity: AlertSeverity
  visualDurationMs: number
  audioVolume: number
}

export const ALERT_SETTINGS_STORAGE_KEY = 'gsm-alert-settings-v1'

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  low: 1.5,
  medium: 3.0,
  high: 6.0,
  critical: 9.0,
}

export const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  thresholds: DEFAULT_ALERT_THRESHOLDS,
  visualEnabled: false,
  audioEnabled: false,
  cooldownMs: 8000,
  reAlertOnStable: true,
  visualMinSeverity: 'medium',
  audioMinSeverity: 'high',
  visualDurationMs: 4200,
  audioVolume: 65,
}

export const ALERT_SEVERITY_ORDER: AlertSeverity[] = ['low', 'medium', 'high', 'critical']

const severityRank: Record<AlertSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

const isAlertSeverity = (value: unknown): value is AlertSeverity => {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
}

export const isSeverityAtLeast = (severity: AlertSeverity, minimum: AlertSeverity): boolean => {
  return severityRank[severity] >= severityRank[minimum]
}

export const alertSeverityLabel: Record<AlertSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const isValidNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const roundToTenths = (value: number): number => Math.round(value * 10) / 10

const safeNumber = (value: unknown, fallback: number): number => {
  return isValidNumber(value) ? value : fallback
}

export const normalizeAlertThresholds = (
  thresholds: Partial<AlertThresholds> | null | undefined,
): AlertThresholds => {
  const low = Math.max(0, safeNumber(thresholds?.low, DEFAULT_ALERT_THRESHOLDS.low))
  const mediumCandidate = safeNumber(thresholds?.medium, DEFAULT_ALERT_THRESHOLDS.medium)
  const medium = Math.max(low + 0.1, mediumCandidate)
  const highCandidate = safeNumber(thresholds?.high, DEFAULT_ALERT_THRESHOLDS.high)
  const high = Math.max(medium + 0.1, highCandidate)
  const criticalCandidate = safeNumber(thresholds?.critical, DEFAULT_ALERT_THRESHOLDS.critical)
  const critical = Math.max(high + 0.1, criticalCandidate)

  return {
    low: roundToTenths(low),
    medium: roundToTenths(medium),
    high: roundToTenths(high),
    critical: roundToTenths(critical),
  }
}

export const normalizeAlertPreferences = (
  input: Partial<AlertPreferences> | null | undefined,
): AlertPreferences => {
  const thresholds = normalizeAlertThresholds(input?.thresholds)
  const cooldownMsCandidate = safeNumber(input?.cooldownMs, DEFAULT_ALERT_PREFERENCES.cooldownMs)
  const cooldownMs = Math.max(1000, Math.round(cooldownMsCandidate))
  const visualDurationCandidate = safeNumber(input?.visualDurationMs, DEFAULT_ALERT_PREFERENCES.visualDurationMs)
  const visualDurationMs = Math.max(1200, Math.round(visualDurationCandidate))
  const audioVolumeCandidate = safeNumber(input?.audioVolume, DEFAULT_ALERT_PREFERENCES.audioVolume)
  const audioVolume = Math.min(100, Math.max(0, Math.round(audioVolumeCandidate)))

  return {
    thresholds,
    visualEnabled: typeof input?.visualEnabled === 'boolean' ? input.visualEnabled : DEFAULT_ALERT_PREFERENCES.visualEnabled,
    audioEnabled: typeof input?.audioEnabled === 'boolean' ? input.audioEnabled : DEFAULT_ALERT_PREFERENCES.audioEnabled,
    cooldownMs,
    reAlertOnStable: typeof input?.reAlertOnStable === 'boolean' ? input.reAlertOnStable : DEFAULT_ALERT_PREFERENCES.reAlertOnStable,
    visualMinSeverity: isAlertSeverity(input?.visualMinSeverity) ? input.visualMinSeverity : DEFAULT_ALERT_PREFERENCES.visualMinSeverity,
    audioMinSeverity: isAlertSeverity(input?.audioMinSeverity) ? input.audioMinSeverity : DEFAULT_ALERT_PREFERENCES.audioMinSeverity,
    visualDurationMs,
    audioVolume,
  }
}

export const evaluateAlertSeverity = (
  frequency: number,
  thresholds: AlertThresholds,
): AlertSeverity | null => {
  if (!Number.isFinite(frequency)) {
    return null
  }

  if (frequency >= thresholds.critical) {
    return 'critical'
  }

  if (frequency >= thresholds.high) {
    return 'high'
  }

  if (frequency >= thresholds.medium) {
    return 'medium'
  }

  if (frequency >= thresholds.low) {
    return 'low'
  }

  return null
}

interface ShouldTriggerAlertArgs {
  previousSeverity: AlertSeverity | null
  nextSeverity: AlertSeverity | null
  lastTriggeredAtMs: number | null
  nowMs: number
  cooldownMs: number
  reAlertOnStable: boolean
}

export const shouldTriggerAlert = ({
  previousSeverity,
  nextSeverity,
  lastTriggeredAtMs,
  nowMs,
  cooldownMs,
  reAlertOnStable,
}: ShouldTriggerAlertArgs): boolean => {
  if (!nextSeverity) {
    return false
  }

  if (nextSeverity !== previousSeverity) {
    return true
  }

  if (!reAlertOnStable) {
    return false
  }

  if (lastTriggeredAtMs === null) {
    return true
  }

  return nowMs - lastTriggeredAtMs >= cooldownMs
}

type StorageReader = Pick<Storage, 'getItem'>
type StorageWriter = Pick<Storage, 'setItem'>

const resolveStorageReader = (reader?: StorageReader): StorageReader | undefined => {
  if (reader) {
    return reader
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage
}

const resolveStorageWriter = (writer?: StorageWriter): StorageWriter | undefined => {
  if (writer) {
    return writer
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return window.localStorage
}

export const readAlertPreferences = (storage?: StorageReader): AlertPreferences => {
  const resolvedStorage = resolveStorageReader(storage)
  if (!resolvedStorage) {
    return DEFAULT_ALERT_PREFERENCES
  }

  try {
    const raw = resolvedStorage.getItem(ALERT_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_ALERT_PREFERENCES
    }

    return normalizeAlertPreferences(JSON.parse(raw) as Partial<AlertPreferences>)
  } catch {
    return DEFAULT_ALERT_PREFERENCES
  }
}

export const saveAlertPreferences = (preferences: AlertPreferences, storage?: StorageWriter): void => {
  const resolvedStorage = resolveStorageWriter(storage)
  if (!resolvedStorage) {
    return
  }

  const normalized = normalizeAlertPreferences(preferences)
  resolvedStorage.setItem(ALERT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
}
