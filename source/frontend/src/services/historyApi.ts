import type {
  HistoryFilters,
  HistoryPageResult,
  HistoryQuery,
  HistoryQueryOptions,
  ReplicaDisconnectionPage,
  SeismicEvent,
} from '../types/seismic'
import type { IncidentCluster } from '../utils/incidents'
import { classifyByFrequency } from '../utils/classification'

const HISTORY_ENDPOINT = import.meta.env.VITE_HISTORY_API_URL as string | undefined

const toQueryString = (query: HistoryQuery): string => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, String(value))
    }
  })
  return params.toString()
}

interface HistoryApiPayload {
  events?: SeismicEvent[]
  total?: number
  limit?: number
  offset?: number
}

const normalizeClassification = (raw: string | undefined | null): import('../types/seismic').EventClassification | undefined => {
  if (!raw) return undefined
  if (raw === 'NUCLEAR_EVENT') return 'NUCLEAR_LIKE'
  return raw as import('../types/seismic').EventClassification
}

const normalizeEvents = (events: SeismicEvent[]): SeismicEvent[] => {
  return events.map((event) => ({
    ...event,
    classification:
      normalizeClassification(event.classification as unknown as string) ??
      classifyByFrequency(event.frequency),
  }))
}

export const fetchHistoryEvents = async (
  filters: HistoryFilters,
  options: HistoryQueryOptions = {},
): Promise<HistoryPageResult> => {
  if (!HISTORY_ENDPOINT) {
    throw new Error('History endpoint is not configured. Set VITE_HISTORY_API_URL.')
  }

  const query: HistoryQuery = {
    type: filters.type === 'ALL' ? undefined : filters.type,
    sensor_id: filters.sensorId || undefined,
    region: filters.region || undefined,
    from: options.from || undefined,
    to: options.to || undefined,
    limit: options.limit,
    offset: options.offset,
  }

  const queryString = toQueryString(query)
  const response = await fetch(`${HISTORY_ENDPOINT}${queryString ? `?${queryString}` : ''}`)
  if (!response.ok) {
    throw new Error(`History request failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as SeismicEvent[] | HistoryApiPayload

  if (Array.isArray(payload)) {
    const normalized = normalizeEvents(payload)
    const offset = options.offset ?? 0
    const limit = Math.max(1, options.limit ?? 50)
    const page = normalized.slice(offset, offset + limit)

    return {
      events: page,
      total: normalized.length,
      offset,
      limit,
      pagingMode: 'client-fallback',
    }
  }

  const normalized = normalizeEvents(payload.events ?? [])
  return {
    events: normalized,
    total: payload.total ?? normalized.length,
    offset: payload.offset ?? (options.offset ?? 0),
    limit: payload.limit ?? Math.max(1, options.limit ?? normalized.length),
    pagingMode: 'server',
  }
}

interface BackendIncidentCluster {
  id: string
  region: string
  severity: string
  from: string
  to: string
  cluster_time: string
  count: number
  peak_frequency: number
  confirmed_count: number
  events: SeismicEvent[]
}

export const fetchIncidentClusters = async (
  windowMinutes: number = 10,
  from?: string,
  to?: string,
): Promise<IncidentCluster[]> => {
  if (!HISTORY_ENDPOINT) {
    throw new Error('History endpoint is not configured. Set VITE_HISTORY_API_URL.')
  }

  const params = new URLSearchParams()
  params.set('windowMinutes', String(windowMinutes))
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  const base = HISTORY_ENDPOINT.replace(/\/events\/?$/, '/events/incidents')
  const response = await fetch(`${base}?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Incident cluster request failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as BackendIncidentCluster[]

  return payload.map((cluster) => ({
    id: cluster.id,
    region: cluster.region,
    severity: mapBackendSeverity(cluster.severity),
    from: cluster.from,
    to: cluster.to,
    clusterTime: cluster.cluster_time,
    count: cluster.count,
    peakFrequency: cluster.peak_frequency,
    confirmedCount: cluster.confirmed_count,
    events: normalizeEvents(cluster.events),
  }))
}

const mapBackendSeverity = (severity: string): import('../types/seismic').EventClassification => {
  if (severity === 'NUCLEAR_EVENT') return 'NUCLEAR_LIKE'
  if (severity === 'CONVENTIONAL_EXPLOSION') return 'CONVENTIONAL_EXPLOSION'
  return 'EARTHQUAKE'
}

export interface EventCorroboration {
  event_id: string
  classification: string
  avg_frequency: number
  region: string
  confirmed: boolean
  reporter_count: number
  replica_ids: string[]
  /** Per-replica detected frequencies (same order as replica_ids) */
  frequencies: number[]
  /** Per-replica classifications, e.g. EARTHQUAKE / NUCLEAR_EVENT (same order as replica_ids) */
  classifications: string[]
  detected_ats: string[]
}

export const fetchEventCorroboration = async (eventId: string): Promise<EventCorroboration | null> => {
  if (!HISTORY_ENDPOINT) return null

  const base = HISTORY_ENDPOINT.replace(/\/events\/?$/, `/events/corroboration/${encodeURIComponent(eventId)}`)
  const response = await fetch(base)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Corroboration request failed with status ${response.status}.`)
  return (await response.json()) as EventCorroboration
}

export const fetchReplicaDisconnections = async (
  page: number = 0,
  size: number = 20,
  replicaId?: string,
): Promise<ReplicaDisconnectionPage> => {
  if (!HISTORY_ENDPOINT) throw new Error('History endpoint is not configured.')

  const parsed = new URL(HISTORY_ENDPOINT)
  parsed.pathname = '/api/infrastructure/disconnections'
  parsed.search = ''
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (replicaId) params.set('replicaId', replicaId)

  const response = await fetch(`${parsed.toString()}?${params.toString()}`)
  if (!response.ok) throw new Error(`Disconnections request failed with status ${response.status}.`)
  return (await response.json()) as ReplicaDisconnectionPage
}
