import type {
  HistoryFilters,
  HistoryPageResult,
  HistoryQuery,
  HistoryQueryOptions,
  SeismicEvent,
} from '../types/seismic'
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

const normalizeEvents = (events: SeismicEvent[]): SeismicEvent[] => {
  return events.map((event) => ({
    ...event,
    classification: event.classification ?? classifyByFrequency(event.frequency),
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
