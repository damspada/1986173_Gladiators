import type { SeismicEvent } from '../types/seismic'

const getTzAbbr = (date: Date, tz: string): string => {
  if (tz === 'UTC') return 'UTC'
  try {
    const part = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')
    return part?.value ?? tz
  } catch {
    return tz
  }
}

export const formatUtcTimestamp = (iso: string, tz = 'UTC'): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'INVALID'
  }
  if (tz === 'UTC') {
    return date.toISOString().replace('T', '\u00a0').replace('Z', '\u00a0UTC')
  }
  try {
    const parts: Record<string, string> = {}
    for (const { type, value } of new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date)) {
      parts[type] = value
    }
    const ms = String(date.getMilliseconds()).padStart(3, '0')
    const abbr = getTzAbbr(date, tz)
    return `${parts.year}-${parts.month}-${parts.day}\u00a0${parts.hour}:${parts.minute}:${parts.second}.${ms}\u00a0${abbr}`
  } catch {
    return date.toISOString().replace('T', '\u00a0').replace('Z', '\u00a0UTC')
  }
}

export const formatFrequency = (value: number): string => `${value.toFixed(2)} Hz`

const csvEscape = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

export const toEventsCsv = (events: SeismicEvent[]): string => {
  const header = ['event_id', 'sensor_id', 'timestamp', 'frequency', 'classification', 'severity', 'region']
  const rows = events.map((event) => [
    event.event_id,
    event.sensor_id,
    event.timestamp,
    event.frequency.toFixed(2),
    event.classification,
    event.severity ?? 'normal',
    event.sensor?.region ?? 'UNSPECIFIED',
  ])

  return [header, ...rows].map((row) => row.map((field) => csvEscape(String(field))).join(',')).join('\n')
}

export const triggerDownload = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
