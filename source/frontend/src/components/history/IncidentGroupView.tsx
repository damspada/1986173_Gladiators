import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import clsx from 'clsx'
import { ZoneNavLink } from '../common/ZoneNavLink'
import { classificationLabel, classificationBadgeClass } from '../../utils/classification'
import { formatUtcTimestamp, formatFrequency } from '../../utils/format'
import { useTimezone } from '../../contexts/TimezoneContext'
import { fetchIncidentClusters } from '../../services/historyApi'
import type { IncidentCluster } from '../../utils/incidents'
import type { HistoryFilters, HistoryTimeFilter, SeismicEvent } from '../../types/seismic'

interface IncidentGroupViewProps {
  onSelectEvent: (event: SeismicEvent) => void
  filters: HistoryFilters
  timeFilter: HistoryTimeFilter
}

const WINDOW_OPTIONS = [5, 10, 15, 30, 60]

const formatSpan = (from: string, to: string): string => {
  const ms = Date.parse(to) - Date.parse(from)
  if (Number.isNaN(ms) || ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`
  const h = Math.floor(min / 60)
  const remMin = min % 60
  return remMin > 0 ? `${h}h ${remMin}m` : `${h}h`
}

export const IncidentGroupView = ({ onSelectEvent, filters, timeFilter }: IncidentGroupViewProps) => {
  const { timezone } = useTimezone()
  const [windowMinutes, setWindowMinutes] = useState(10)
  const [clusters, setClusters] = useState<IncidentCluster[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = timeFilter.fromUtc ? new Date(`${timeFilter.fromUtc}:00Z`).toISOString() : undefined
      const to = timeFilter.toUtc ? new Date(`${timeFilter.toUtc}:00Z`).toISOString() : undefined
      const result = await fetchIncidentClusters(windowMinutes, from, to)
      setClusters(result)
    } catch (err: unknown) {
      setClusters([])
      setError(err instanceof Error ? err.message : 'Failed to load incident clusters.')
    } finally {
      setLoading(false)
    }
  }, [windowMinutes, timeFilter.fromUtc, timeFilter.toUtc])

  useEffect(() => {
    void load()
  }, [load])

  const filteredClusters = useMemo(() => {
    let result = clusters
    if (filters.region) result = result.filter((c: IncidentCluster) => c.region === filters.region)
    if (filters.type !== 'ALL') result = result.filter((c: IncidentCluster) => c.severity === filters.type)
    return result
  }, [clusters, filters])

  const toggle = (id: string) => setExpandedId((prev: string | null) => (prev === id ? null : id))

  return (
    <section className="tactical-panel p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          <span>Incident Clusters</span>
          <span className="text-zinc-500">|</span>
          <span>{filteredClusters.length} clusters</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Window</label>
          <select
            value={windowMinutes}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setWindowMinutes(Number(e.target.value))}
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300 outline-none focus:border-cyan-500/60"
          >
            {WINDOW_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-sm border border-cyan-500/70 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-2 text-[11px] text-rose-400">{error}</p>
      )}

      {clusters.length === 0 && !loading && !error && (
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          No incident clusters found in the selected window.
        </p>
      )}

      <div className="space-y-2">
        {filteredClusters.map((cluster: IncidentCluster) => {
          const isExpanded = expandedId === cluster.id
          return (
            <div
              key={cluster.id}
              className="rounded-sm border border-zinc-700/80 bg-zinc-900/60"
            >
              <button
                type="button"
                onClick={() => toggle(cluster.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-zinc-800/60"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={clsx(
                      'inline-block rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                      classificationBadgeClass[cluster.severity],
                    )}
                  >
                    {classificationLabel[cluster.severity]}
                  </span>
                  <ZoneNavLink zone={cluster.region} className="px-0 py-0 text-xs text-zinc-100 hover:text-cyan-200" />
                  <span className="text-[11px] text-zinc-400">
                    {cluster.count} event{cluster.count !== 1 ? 's' : ''}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500" title="Cluster detected at">
                    {formatUtcTimestamp(cluster.clusterTime, timezone)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[11px] text-zinc-400">
                  {cluster.peakFrequency != null && (
                    <span title="Peak frequency">Peak {formatFrequency(cluster.peakFrequency)}</span>
                  )}
                  {cluster.confirmedCount != null && cluster.confirmedCount > 0 && (
                    <span className="text-emerald-400" title="Confirmed events">
                      {cluster.confirmedCount}/{cluster.count} confirmed
                    </span>
                  )}
                  <span title="Cluster duration">{formatSpan(cluster.from, cluster.to)}</span>
                  <span className="text-[10px] text-zinc-500">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-zinc-700/60 px-3 py-2">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                        <th className="pb-1 pr-3 font-normal">Timestamp</th>
                        <th className="pb-1 pr-3 font-normal">Sensor</th>
                        <th className="pb-1 pr-3 font-normal">Type</th>
                        <th className="pb-1 pr-3 font-normal text-right">Frequency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cluster.events.map((event) => (
                        <tr
                          key={event.event_id}
                          onClick={() => onSelectEvent(event)}
                          className="cursor-pointer text-zinc-300 transition hover:bg-zinc-800/40 hover:text-zinc-100"
                        >
                          <td className="py-0.5 pr-3 font-mono text-zinc-400">
                            {formatUtcTimestamp(event.timestamp, timezone)}
                          </td>
                          <td className="py-0.5 pr-3">{event.sensor_id}</td>
                          <td className="py-0.5 pr-3">
                            <span
                              className={clsx(
                                'inline-block rounded-sm border px-1 py-px text-[9px] uppercase',
                                classificationBadgeClass[event.classification],
                              )}
                            >
                              {classificationLabel[event.classification]}
                            </span>
                          </td>
                          <td className="py-0.5 text-right font-mono">{formatFrequency(event.frequency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
