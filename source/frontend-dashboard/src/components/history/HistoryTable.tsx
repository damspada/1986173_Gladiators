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
    <section className="tactical-panel module-reveal p-5">
      <h2 className="mb-4 text-xs uppercase tracking-[0.28em] text-zinc-400">Historical Records</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200/15 bg-slate-950/20">
        <div className="overflow-x-auto">
          <div className="grid min-w-[50rem] grid-cols-[7rem_12rem_8rem_12rem_1fr] bg-slate-900/55 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            <span className="whitespace-nowrap">Sensor</span>
            <span className="whitespace-nowrap">Timestamp</span>
            <span className="whitespace-nowrap">Frequency</span>
            <span className="whitespace-nowrap">Classification</span>
            <span className="whitespace-nowrap">Region</span>
          </div>
        </div>
        <div className="max-h-[24rem] overflow-auto bg-slate-950/30">
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
                className="liquid-hover grid min-w-[50rem] grid-cols-[7rem_12rem_8rem_12rem_1fr] items-center border-b border-slate-300/10 px-3 py-2 text-xs text-zinc-200 transition hover:bg-cyan-300/8"
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
                <span className="whitespace-nowrap font-medium text-zinc-100">{event.sensor_id}</span>
                <span className="whitespace-nowrap text-zinc-400">{formatUtcTimestamp(event.timestamp)}</span>
                <span className="whitespace-nowrap">{formatFrequency(event.frequency)}</span>
                <span
                  className={clsx(
                    'inline-flex max-w-fit whitespace-nowrap rounded-sm border px-2 py-1 text-[11px] uppercase tracking-[0.08em]',
                    classificationBadgeClass[event.classification],
                  )}
                >
                  {classificationLabel[event.classification]}
                </span>
                <span className="truncate">{event.sensor?.region ?? 'UNSPECIFIED'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
