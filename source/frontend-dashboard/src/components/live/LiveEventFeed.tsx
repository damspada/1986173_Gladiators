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
    <section className="tactical-panel module-reveal h-full p-5">
      <div className="mb-4 flex items-center justify-between micro-label">
        <span>Live Event Feed</span>
        <span>{events.length} records buffered</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/15 bg-slate-950/20">
        <div className="overflow-x-auto">
          <div className="grid min-w-[34rem] grid-cols-[6.5rem_11rem_8rem_1fr] bg-slate-900/55 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            <span className="whitespace-nowrap">Sensor</span>
            <span className="whitespace-nowrap">Timestamp (UTC)</span>
            <span className="whitespace-nowrap">Frequency</span>
            <span className="whitespace-nowrap">Classification</span>
          </div>
        </div>
        <div ref={scrollRef} className="max-h-[24rem] overflow-auto bg-slate-950/30">
          {events.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm uppercase tracking-[0.2em] text-zinc-500">Awaiting live events...</p>
          ) : (
            events.map((event) => (
              <div
                key={event.event_id}
                className="liquid-hover grid min-w-[34rem] grid-cols-[6.5rem_11rem_8rem_1fr] items-center gap-2 border-b border-slate-300/10 px-3 py-2 text-xs text-zinc-200 transition hover:bg-cyan-300/8"
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
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
