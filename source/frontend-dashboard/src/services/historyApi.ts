import type { HistoryFilters, HistoryQuery, SeismicEvent } from '../types/seismic'
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

export const fetchHistoryEvents = async (filters: HistoryFilters): Promise<SeismicEvent[]> => {
  if (!HISTORY_ENDPOINT) {
    throw new Error('History endpoint is not configured. Set VITE_HISTORY_API_URL.')
  }

  const query: HistoryQuery = {
    type: filters.type === 'ALL' ? undefined : filters.type,
    sensor_id: filters.sensorId || undefined,
    region: filters.region || undefined,
  }

  const queryString = toQueryString(query)
  const response = await fetch(`${HISTORY_ENDPOINT}${queryString ? `?${queryString}` : ''}`)
  if (!response.ok) {
    throw new Error(`History request failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as SeismicEvent[]
  return payload.map((event) => ({
    ...event,
    classification: event.classification ?? classifyByFrequency(event.frequency),
  }))
}
