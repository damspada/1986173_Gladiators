import clsx from 'clsx'
import { classificationBadgeClass, classificationLabel } from '../../utils/classification'
import { formatFrequency, formatUtcTimestamp } from '../../utils/format'
import type { SeismicEvent } from '../../types/seismic'

interface HistoryTableProps {
  events: SeismicEvent[]
  loading: boolean
  error?: string | null
  onSelectEvent: (event: SeismicEvent) => void
}

export const HistoryTable = ({ events, loading, error, onSelectEvent }: HistoryTableProps) => {
  return (
    <section className="tactical-panel p-4">
      <h2 className="section-greeble mb-3 text-xs uppercase tracking-[0.26em] text-zinc-400">Historical Records</h2>
      <div className="cyber-table-shell overflow-hidden border border-zinc-700/90">
        <div className="cyber-table-head grid grid-cols-[0.8fr_1.4fr_0.8fr_1.2fr_1.2fr] bg-zinc-900 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          <span>Sensor</span>
          <span>Timestamp</span>
          <span>Frequency</span>
          <span>Classification</span>
          <span>Region</span>
        </div>
        <div className="cyber-table-body max-h-[22rem] overflow-y-auto bg-zinc-950/70">
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
                className="cyber-table-row u-neon-flicker grid grid-cols-[0.8fr_1.4fr_0.8fr_1.2fr_1.2fr] items-center border-b border-zinc-800/70 px-3 py-2 text-xs text-zinc-200 transition"
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
                <span className="font-medium text-zinc-100">{event.sensor_id}</span>
                <span className="text-zinc-400">{formatUtcTimestamp(event.timestamp)}</span>
                <span>{formatFrequency(event.frequency)}</span>
                <span
                  className={clsx(
                    'classification-chip inline-flex max-w-fit border px-2 py-1 text-[11px] uppercase tracking-[0.08em]',
                    classificationBadgeClass[event.classification],
                  )}
                >
                  {classificationLabel[event.classification]}
                </span>
                <span>{event.sensor?.region ?? 'UNSPECIFIED'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
