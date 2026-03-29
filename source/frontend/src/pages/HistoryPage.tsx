import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { EventTimeline } from '../components/history/EventTimeline'
import { HistoryFiltersPanel } from '../components/history/HistoryFilters'
import { HistoryTable } from '../components/history/HistoryTable'
import { IncidentGroupView } from '../components/history/IncidentGroupView'
import { fetchHistoryEvents } from '../services/historyApi'
import { toEventsCsv, triggerDownload } from '../utils/format'
import type { HistoryFilters, HistoryTimeFilter, SeismicEvent } from '../types/seismic'

interface HistoryPageProps {
  onSelectEvent: (event: SeismicEvent) => void
}

const DEFAULT_FILTERS: HistoryFilters = {
  type: 'ALL',
  sensorId: '',
  region: '',
}

const DEFAULT_TIME_FILTER: HistoryTimeFilter = {
  fromUtc: '',
  toUtc: '',
  preset: null,
}

const applyTimeFilter = (events: SeismicEvent[], timeFilter: HistoryTimeFilter): SeismicEvent[] => {
  const parseUtcDateTimeLocal = (value: string): number | null => {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
    if (!match) return null
    const [, year, month, day, hour, minute] = match
    return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
  }
  const fromMs = parseUtcDateTimeLocal(timeFilter.fromUtc)
  const toMs = parseUtcDateTimeLocal(timeFilter.toUtc)
  if (fromMs === null && toMs === null) return events
  const lower = fromMs !== null && toMs !== null ? Math.min(fromMs, toMs) : (fromMs ?? Number.NEGATIVE_INFINITY)
  const upper = fromMs !== null && toMs !== null ? Math.max(fromMs, toMs) : (toMs ?? Number.POSITIVE_INFINITY)
  return events.filter((event) => {
    const eventMs = Date.parse(event.startsAt ?? event.timestamp)
    return !Number.isNaN(eventMs) && eventMs >= lower && eventMs <= upper
  })
}

export const HistoryPage = ({ onSelectEvent }: HistoryPageProps) => {
  const [activeTab, setActiveTab] = useState<'incidents' | 'timeline' | 'records'>('incidents')
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS)
  const [timeFilter, setTimeFilter] = useState<HistoryTimeFilter>(DEFAULT_TIME_FILTER)
  const [events, setEvents] = useState<SeismicEvent[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(50)
  const [pagingMode, setPagingMode] = useState<'server' | 'client-fallback'>('server')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchHistoryEvents(DEFAULT_FILTERS, {
        from: timeFilter.fromUtc ? new Date(`${timeFilter.fromUtc}:00Z`).toISOString() : undefined,
        to: timeFilter.toUtc ? new Date(`${timeFilter.toUtc}:00Z`).toISOString() : undefined,
        limit,
        offset,
      })
      setEvents(result.events)
      setTotal(result.total)
      setPagingMode(result.pagingMode)
      setError(null)
    } catch (err: unknown) {
      setEvents([])
      setTotal(0)
      setError(err instanceof Error ? err.message : 'Unable to load history events.')
    } finally {
      setLoading(false)
    }
  }, [limit, offset, timeFilter.fromUtc, timeFilter.toUtc])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  const latestEventMs = useMemo(() => {
    const timestamps = events
      .map((event: SeismicEvent) => Date.parse(event.startsAt ?? event.timestamp))
      .filter((value: number) => !Number.isNaN(value))

    if (timestamps.length === 0) {
      return 0
    }

    return Math.max(...timestamps)
  }, [events])

  const filteredEvents = useMemo(() => {
    let result = events
    if (filters.type !== 'ALL') result = result.filter((e: SeismicEvent) => e.classification === filters.type)
    if (filters.sensorId) result = result.filter((e: SeismicEvent) => e.sensor_id === filters.sensorId)
    if (filters.region) result = result.filter((e: SeismicEvent) => (e.sensor?.region ?? '') === filters.region)
    return applyTimeFilter(result, timeFilter)
  }, [events, filters, timeFilter])

  const availableSensors = useMemo(() => [...new Set(events.map((event: SeismicEvent) => event.sensor_id))], [events])
  const availableRegions = useMemo(
    () => [...new Set(events.map((event: SeismicEvent) => event.sensor?.region).filter(Boolean))] as string[],
    [events],
  )

  const exportCsv = () => {
    const csv = toEventsCsv(filteredEvents)
    triggerDownload(csv, `history-${new Date().toISOString()}.csv`, 'text/csv;charset=utf-8')
  }

  const exportJson = () => {
    triggerDownload(
      JSON.stringify(filteredEvents, null, 2),
      `history-${new Date().toISOString()}.json`,
      'application/json;charset=utf-8',
    )
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <HistoryFiltersPanel
        filters={filters}
        availableSensors={availableSensors}
        availableRegions={availableRegions}
        timeFilter={timeFilter}
        anchorMs={latestEventMs}
        loading={loading}
        onFiltersChange={setFilters}
        onTimeFilterChange={setTimeFilter}
        onRefresh={() => void refreshHistory()}
      />
      <div className="space-y-4">
        {/* Tab bar */}
        <div className="flex gap-0 border-b border-zinc-700/80">
          {(
            [
              { key: 'incidents', label: 'Incident Clusters' },
              { key: 'timeline', label: 'Event Timeline' },
              { key: 'records', label: 'Historical Records' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={clsx(
                'px-4 py-2 text-[10px] uppercase tracking-[0.18em] transition-colors',
                activeTab === key
                  ? 'border-b-2 border-cyan-400 text-cyan-200'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'incidents' && (
          <IncidentGroupView
            onSelectEvent={onSelectEvent}
            filters={filters}
            timeFilter={timeFilter}
          />
        )}

        {activeTab === 'timeline' && (
          <EventTimeline events={filteredEvents} onSelectEvent={onSelectEvent} />
        )}

        {activeTab === 'records' && (
          <HistoryTable
            events={filteredEvents}
            loading={loading}
            error={error}
            total={total}
            offset={offset}
            limit={limit}
            pagingMode={pagingMode}
            onPageChange={setOffset}
            onExportCsv={exportCsv}
            onExportJson={exportJson}
            onSelectEvent={onSelectEvent}
          />
        )}
      </div>
    </section>
  )
}
