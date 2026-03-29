import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { SensorNavLink } from '../common/SensorNavLink'
import { classificationBadgeClass, classificationLabel } from '../../utils/classification'
import { formatFrequency, formatUtcTimestamp } from '../../utils/format'
import type { SeismicEvent } from '../../types/seismic'

interface LiveEventFeedProps {
  events: SeismicEvent[]
  onSelectEvent: (event: SeismicEvent) => void
}

export const LiveEventFeed = ({ events, onSelectEvent }: LiveEventFeedProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const seenEventIdsRef = useRef<Set<string>>(new Set())
  const animationTimerRef = useRef<number | null>(null)
  const [animatedRowIds, setAnimatedRowIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }

    el.scrollTop = 0
  }, [events])

  useEffect(() => {
    const freshIds = events
      .filter((event) => !seenEventIdsRef.current.has(event.event_id))
      .map((event) => event.event_id)

    seenEventIdsRef.current = new Set(events.map((event) => event.event_id))

    if (freshIds.length === 0) {
      return
    }

    setAnimatedRowIds((previous) => {
      const next = new Set(previous)
      for (const id of freshIds) {
        next.add(id)
      }
      return next
    })

    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current)
    }

    animationTimerRef.current = window.setTimeout(() => {
      setAnimatedRowIds(new Set())
      animationTimerRef.current = null
    }, 1800)
  }, [events])

  useEffect(() => {
    return () => {
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current)
      }
    }
  }, [])

  const classificationClass: Record<SeismicEvent['classification'], string> = {
    EARTHQUAKE: 'threat-earthquake',
    CONVENTIONAL_EXPLOSION: 'threat-explosion',
    NUCLEAR_LIKE: 'threat-nuclear',
  }

  return (
    <section className="tactical-panel p-4">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.24em] text-zinc-400">
        <span>Live Event Feed</span>
        <span>{events.length} records buffered</span>
      </div>
      <div className="overflow-hidden rounded-sm border border-zinc-700/90">
        <div className="grid grid-cols-[1fr_1.4fr_0.9fr_1.2fr] bg-zinc-900 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          <span>Sensor</span>
          <span>Timestamp (UTC)</span>
          <span>Frequency</span>
          <span>Classification</span>
        </div>
        <div ref={scrollRef} className="max-h-[18rem] overflow-y-auto bg-zinc-950/70">
          {events.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm uppercase tracking-[0.2em] text-zinc-500">Awaiting live events...</p>
          ) : (
            events.map((event) => (
              <div
                key={event.event_id}
                className={clsx(
                  'live-feed-row grid grid-cols-[1fr_1.4fr_0.9fr_1.2fr] items-center gap-2 border-b border-zinc-800/80 px-3 py-2 text-xs text-zinc-200 transition hover:bg-zinc-900/40',
                  classificationClass[event.classification],
                  animatedRowIds.has(event.event_id) && 'live-feed-row--fresh',
                )}
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
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
