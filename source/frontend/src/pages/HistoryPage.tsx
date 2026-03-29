import { useCallback, useEffect, useMemo, useState } from 'react'
import { EventTimeline } from '../components/history/EventTimeline'
import { HistoryFiltersPanel } from '../components/history/HistoryFilters'
import { HistoryTimeControls } from '../components/history/HistoryTimeControls'
import { HistoryTable } from '../components/history/HistoryTable'
import { ZoneNavLink } from '../components/common/ZoneNavLink'
import { fetchHistoryEvents } from '../services/historyApi'
import { groupEventsByIncident } from '../utils/incidents'
import { classificationLabel } from '../utils/classification'
import { toEventsCsv, triggerDownload } from '../utils/format'
import type { HistoryFilterRule, HistoryFilters, HistoryTimeFilter, SeismicEvent } from '../types/seismic'

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

const parseUtcDateTimeLocal = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute] = match
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  )
}

const eventMatchesRule = (event: SeismicEvent, rule: HistoryFilterRule): boolean => {
  const value = rule.value.trim().toLowerCase()
  if (!value) {
    return true
  }

  if (rule.category === 'type') {
    return event.classification.toLowerCase() === value
  }

  if (rule.category === 'sensor') {
    return event.sensor_id.toLowerCase() === value
  }

  return (event.sensor?.region ?? '').toLowerCase() === value
}

const applyRuleFilters = (events: SeismicEvent[], rules: HistoryFilterRule[]): SeismicEvent[] => {
  if (rules.length === 0) {
    return events
  }

  return events.filter((event) => {
    const includeRules = rules.filter((rule) => rule.mode === 'include')
    const excludeRules = rules.filter((rule) => rule.mode === 'exclude')

    const includeOk = includeRules.every((rule) => eventMatchesRule(event, rule))
    const excludeOk = excludeRules.every((rule) => !eventMatchesRule(event, rule))

    return includeOk && excludeOk
  })
}

const applyTimeFilter = (events: SeismicEvent[], timeFilter: HistoryTimeFilter): SeismicEvent[] => {
  const fromMs = parseUtcDateTimeLocal(timeFilter.fromUtc)
  const toMs = parseUtcDateTimeLocal(timeFilter.toUtc)

  if (fromMs === null && toMs === null) {
    return events
  }

  const lower = fromMs !== null && toMs !== null ? Math.min(fromMs, toMs) : (fromMs ?? Number.NEGATIVE_INFINITY)
  const upper = fromMs !== null && toMs !== null ? Math.max(fromMs, toMs) : (toMs ?? Number.POSITIVE_INFINITY)

  return events.filter((event) => {
    const eventMs = Date.parse(event.startsAt ?? event.timestamp)
    if (Number.isNaN(eventMs)) {
      return false
    }

    return eventMs >= lower && eventMs <= upper
  })
}

export const HistoryPage = ({ onSelectEvent }: HistoryPageProps) => {
  const [rules, setRules] = useState<HistoryFilterRule[]>([])
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) {
        return
      }

      if (event.key === 'ArrowRight' && offset + limit < total) {
        setOffset((value) => value + limit)
      }

      if (event.key === 'ArrowLeft' && offset > 0) {
        setOffset((value) => Math.max(0, value - limit))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [limit, offset, total])

  const latestEventMs = useMemo(() => {
    const timestamps = events
      .map((event) => Date.parse(event.startsAt ?? event.timestamp))
      .filter((value) => !Number.isNaN(value))

    if (timestamps.length === 0) {
      return 0
    }

    return Math.max(...timestamps)
  }, [events])

  const filteredEvents = useMemo(() => {
    const byRules = applyRuleFilters(events, rules)
    return applyTimeFilter(byRules, timeFilter)
  }, [events, rules, timeFilter])

  const availableSensors = useMemo(() => [...new Set(events.map((event) => event.sensor_id))], [events])
  const availableRegions = useMemo(
    () => [...new Set(events.map((event) => event.sensor?.region).filter(Boolean))] as string[],
    [events],
  )

  const handleFiltersChange = (next: HistoryFilterRule[]) => setRules(next)
  const regionIncidents = useMemo(() => groupEventsByIncident(filteredEvents, 10 * 60 * 1000), [filteredEvents])

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
        value={rules}
        availableSensors={availableSensors}
        availableRegions={availableRegions}
        onChange={handleFiltersChange}
      />
      <div className="space-y-4">
        <section className="tactical-panel flex items-center justify-between gap-2 bg-[#0a0a0a] p-3 font-mono">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            History sync control
          </p>
          <button
            type="button"
            className="rounded-sm border border-cyan-500/70 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
            onClick={() => void refreshHistory()}
            disabled={loading}
          >
            {loading ? 'Syncing...' : 'Refresh Latest Events'}
          </button>
        </section>
        <HistoryTimeControls value={timeFilter} onChange={setTimeFilter} anchorMs={latestEventMs} />
        <section className="tactical-panel p-3">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-400">
            <span>Region Incidents</span>
            <span>{regionIncidents.length} regions in view</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {regionIncidents.slice(0, 6).map((region) => (
              <div key={region.id} className="rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-2 py-2 text-xs">
                <p className="uppercase tracking-[0.08em] text-zinc-100">
                  <ZoneNavLink zone={region.region} className="px-0 py-0 text-zinc-100 hover:text-cyan-200" />
                </p>
                <p className="mt-1 text-zinc-400">{region.count} events | {classificationLabel[region.severity]}</p>
              </div>
            ))}
            {regionIncidents.length === 0 ? (
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">No regions in selected window.</p>
            ) : null}
          </div>
        </section>
        <EventTimeline events={filteredEvents} onSelectEvent={onSelectEvent} />
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
      </div>
    </section>
  )
}
