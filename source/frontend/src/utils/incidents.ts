import type { EventClassification, SeismicEvent } from '../types/seismic'

export interface IncidentCluster {
  id: string
  region: string
  severity: EventClassification
  from: string
  to: string
  count: number
  events: SeismicEvent[]
  peakFrequency?: number
  confirmedCount?: number
}

const severityRank: Record<EventClassification, number> = {
  EARTHQUAKE: 1,
  CONVENTIONAL_EXPLOSION: 2,
  NUCLEAR_LIKE: 3,
}

const pickSeverity = (events: SeismicEvent[]): EventClassification => {
  return events.reduce<EventClassification>((current, event) => {
    return severityRank[event.classification] > severityRank[current] ? event.classification : current
  }, 'EARTHQUAKE')
}

export const groupEventsByIncident = (
  events: SeismicEvent[],
  windowMs: number = 5 * 60 * 1000,
): IncidentCluster[] => {
  if (events.length === 0) {
    return []
  }

  const ordered = [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  const clusters: IncidentCluster[] = []

  for (const event of ordered) {
    const region = event.sensor?.region ?? 'UNSPECIFIED'
    const eventMs = Date.parse(event.timestamp)
    if (Number.isNaN(eventMs)) {
      continue
    }

    const last = clusters[clusters.length - 1]
    if (!last) {
      clusters.push({
        id: `${region}-${event.timestamp}`,
        region,
        severity: event.classification,
        from: event.timestamp,
        to: event.timestamp,
        count: 1,
        events: [event],
      })
      continue
    }

    const lastMs = Date.parse(last.to)
    if (last.region === region && eventMs - lastMs <= windowMs) {
      last.events.push(event)
      last.to = event.timestamp
      last.count += 1
      last.severity = pickSeverity(last.events)
      continue
    }

    clusters.push({
      id: `${region}-${event.timestamp}`,
      region,
      severity: event.classification,
      from: event.timestamp,
      to: event.timestamp,
      count: 1,
      events: [event],
    })
  }

  return clusters.sort((a, b) => Date.parse(b.to) - Date.parse(a.to))
}
