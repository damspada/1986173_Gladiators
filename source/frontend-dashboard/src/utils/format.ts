import type { SeismicEvent } from '../types/seismic'

export const formatUtcTimestamp = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'INVALID UTC'
  }
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC')
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
