import { useCallback, useEffect, useMemo, useState } from 'react'
import { EventTimeline } from '../components/history/EventTimeline'
import { HistoryFiltersPanel } from '../components/history/HistoryFilters'
import { HistoryTimeControls } from '../components/history/HistoryTimeControls'
import { HistoryTable } from '../components/history/HistoryTable'
import { fetchHistoryEvents } from '../services/historyApi'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchHistoryEvents(DEFAULT_FILTERS)
      setEvents(result)
      setError(null)
    } catch (err: unknown) {
      setEvents([])
      setError(err instanceof Error ? err.message : 'Unable to load history events.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

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
        <EventTimeline events={filteredEvents} onSelectEvent={onSelectEvent} />
        <HistoryTable events={filteredEvents} loading={loading} error={error} onSelectEvent={onSelectEvent} />
      </div>
    </section>
  )
}
