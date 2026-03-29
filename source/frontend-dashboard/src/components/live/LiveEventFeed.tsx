import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import { classificationBadgeClass, classificationLabel } from '../../utils/classification'
import { formatFrequency, formatUtcTimestamp } from '../../utils/format'
import type { SeismicEvent } from '../../types/seismic'

interface LiveEventFeedProps {
  events: SeismicEvent[]
  onSelectEvent: (event: SeismicEvent) => void
}

export const LiveEventFeed = ({ events, onSelectEvent }: LiveEventFeedProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }

    el.scrollTop = 0
  }, [events])

  return (
    <section className="tactical-panel p-4">
      <div className="section-greeble mb-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-zinc-400">
        <span>Live Event Feed</span>
        <span>{events.length} records buffered</span>
      </div>
      <div className="cyber-table-shell overflow-hidden border border-zinc-700/90">
        <div className="cyber-table-head grid grid-cols-[1fr_1.4fr_0.9fr_1.2fr] bg-zinc-900 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          <span>Sensor</span>
          <span>Timestamp (UTC)</span>
          <span>Frequency</span>
          <span>Classification</span>
        </div>
        <div ref={scrollRef} className="cyber-table-body max-h-[18rem] overflow-y-auto bg-zinc-950/70">
          {events.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm uppercase tracking-[0.2em] text-zinc-500">Awaiting live events...</p>
          ) : (
            events.map((event) => (
              <div
                key={event.event_id}
                className="cyber-table-row u-neon-flicker grid grid-cols-[1fr_1.4fr_0.9fr_1.2fr] items-center gap-2 border-b border-zinc-800/80 px-3 py-2 text-xs text-zinc-200 transition"
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
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
