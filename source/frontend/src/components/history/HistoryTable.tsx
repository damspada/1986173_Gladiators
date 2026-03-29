import clsx from 'clsx'
import { SensorNavLink } from '../common/SensorNavLink'
import { ZoneNavLink } from '../common/ZoneNavLink'
import { classificationBadgeClass, classificationLabel } from '../../utils/classification'
import { formatFrequency, formatUtcTimestamp } from '../../utils/format'
import type { SeismicEvent } from '../../types/seismic'

interface HistoryTableProps {
  events: SeismicEvent[]
  loading: boolean
  error?: string | null
  total: number
  offset: number
  limit: number
  pagingMode: 'server' | 'client-fallback'
  onPageChange: (nextOffset: number) => void
  onExportCsv: () => void
  onExportJson: () => void
  onSelectEvent: (event: SeismicEvent) => void
}

export const HistoryTable = ({
  events,
  loading,
  error,
  total,
  offset,
  limit,
  pagingMode,
  onPageChange,
  onExportCsv,
  onExportJson,
  onSelectEvent,
}: HistoryTableProps) => {
  const pageStart = Math.min(total, offset + 1)
  const pageEnd = Math.min(total, offset + events.length)
  const canPrev = offset > 0
  const canNext = offset + limit < total

  return (
    <section className="tactical-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.26em] text-zinc-400">Historical Records</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-200 transition hover:border-cyan-400/70 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            onClick={onExportCsv}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-200 transition hover:border-cyan-400/70 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            onClick={onExportJson}
          >
            Export JSON
          </button>
        </div>
      </div>

      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        {pagingMode === 'server' ? 'Server paging enabled' : 'Client fallback paging'} | showing {events.length === 0 ? 0 : pageStart}-{pageEnd} of {total}
      </p>

      <div className="overflow-x-auto rounded-sm border border-zinc-700/90">
        <div className="min-w-[56rem]">
          <div className="grid grid-cols-[0.8fr_1.4fr_0.7fr_1.1fr_1fr_0.8fr] bg-zinc-900 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            <span>Sensor</span>
            <span>Timestamp</span>
            <span>Frequency</span>
            <span>Classification</span>
            <span>Region</span>
            <span>Severity</span>
          </div>
          <div className="max-h-[22rem] overflow-y-auto bg-zinc-950/70">
          {loading ? (
            <p className="px-3 py-10 text-center text-sm uppercase tracking-[0.2em] text-zinc-500">Loading history...</p>
          ) : error ? (
            <p className="px-3 py-10 text-center text-sm uppercase tracking-[0.12em] text-rose-400">{error}</p>
          ) : events.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm uppercase tracking-[0.2em] text-zinc-500">No records found.</p>
          ) : (
            events.map((event) => (
              <div
                key={event.event_id}
                className="grid grid-cols-[0.8fr_1.4fr_0.7fr_1.1fr_1fr_0.8fr] items-center border-b border-zinc-800/70 px-3 py-2 text-xs text-zinc-200 transition hover:bg-zinc-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                role="button"
                tabIndex={0}
                onClick={() => onSelectEvent(event)}
                onKeyDown={(keyEvent) => {
                  if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                    keyEvent.preventDefault()
                    onSelectEvent(event)
                  }
                }}
              >
                <span className="font-medium text-zinc-100">
                  <SensorNavLink sensorId={event.sensor_id} className="px-0 py-0 text-zinc-100 hover:text-cyan-200" />
                </span>
                <span className="text-zinc-400">{formatUtcTimestamp(event.timestamp)}</span>
                <span>{formatFrequency(event.frequency)}</span>
                <span
                  className={clsx(
                    'inline-flex max-w-fit rounded-sm border px-2 py-1 text-[11px] uppercase tracking-[0.08em]',
                    classificationBadgeClass[event.classification],
                  )}
                >
                  {classificationLabel[event.classification]}
                </span>
                <span>
                  {event.sensor?.region ? (
                    <ZoneNavLink zone={event.sensor.region} className="px-0 py-0 text-zinc-200 hover:text-cyan-200" />
                  ) : (
                    'UNSPECIFIED'
                  )}
                </span>
                <span
                  className={clsx(
                    'inline-flex max-w-fit rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.08em]',
                    event.severity === 'critical'
                      ? 'border-rose-500/70 bg-rose-500/15 text-rose-200'
                      : event.severity === 'warning'
                        ? 'border-amber-500/70 bg-amber-500/15 text-amber-200'
                        : 'border-emerald-500/70 bg-emerald-500/10 text-emerald-200',
                  )}
                >
                  {(event.severity ?? 'normal').toUpperCase()}
                </span>
              </div>
            ))
          )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
        <span>Use Alt+ArrowLeft / Alt+ArrowRight for page navigation</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canPrev || loading}
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 transition hover:border-cyan-400/70 hover:text-cyan-200 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
            onClick={() => onPageChange(Math.max(0, offset - limit))}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!canNext || loading}
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200 transition hover:border-cyan-400/70 hover:text-cyan-200 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
            onClick={() => onPageChange(offset + limit)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
