import clsx from 'clsx'
import { type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent, useEffect, useMemo, useRef, useState } from 'react'
import { classificationLabel } from '../../utils/classification'
import { formatUtcTimestamp } from '../../utils/format'
import type { SeismicEvent } from '../../types/seismic'

interface EventTimelineProps {
  events: SeismicEvent[]
  onSelectEvent: (event: SeismicEvent) => void
}

const TRACK_HEIGHT = 34
const TRACK_GAP = 10
const ROW_HEIGHT = TRACK_HEIGHT + TRACK_GAP
const AXIS_STEP_SECONDS = 30
const MAX_AXIS_LABELS = 6
const MIN_WINDOW_RATIO = 0.14
const DEFAULT_WINDOW_RATIO = 0.34

const toneClass: Record<SeismicEvent['classification'], string> = {
  EARTHQUAKE: 'border-cyan-300/80 bg-cyan-500 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.75)]',
  CONVENTIONAL_EXPLOSION: 'border-amber-300/80 bg-amber-500 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.75)]',
  NUCLEAR_LIKE: 'border-rose-300/80 bg-rose-600 text-rose-100 shadow-[0_0_12px_rgba(225,29,72,0.75)]',
}

const toMs = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const getStartsAtMs = (event: SeismicEvent): number => {
  return toMs(event.startsAt) ?? toMs(event.timestamp) ?? Date.now()
}

const getDurationSeconds = (event: SeismicEvent): number | null => {
  if (typeof event.durationSeconds === 'number' && event.durationSeconds > 0) {
    return event.durationSeconds
  }

  const startsAt = toMs(event.startsAt) ?? toMs(event.timestamp)
  const endsAt = toMs(event.endsAt)
  if (startsAt && endsAt && endsAt > startsAt) {
    return Math.max(1, Math.round((endsAt - startsAt) / 1000))
  }

  return null
}

const formatAxisUtc = (ms: number): string => {
  const d = new Date(ms)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss} UTC`
}

export const EventTimeline = ({ events, onSelectEvent }: EventTimelineProps) => {
  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => getStartsAtMs(a) - getStartsAtMs(b)),
    [events],
  )

  const groupedBySensor = useMemo(
    () =>
      orderedEvents.reduce<Map<string, SeismicEvent[]>>((acc, event) => {
        const list = acc.get(event.sensor_id) ?? []
        list.push(event)
        acc.set(event.sensor_id, list)
        return acc
      }, new Map()),
    [orderedEvents],
  )

  const sensors = useMemo(() => Array.from(groupedBySensor.keys()), [groupedBySensor])
  const hasEvents = orderedEvents.length > 0
  const firstStart = hasEvents ? getStartsAtMs(orderedEvents[0]) : 0
  const lastStart = hasEvents ? getStartsAtMs(orderedEvents[orderedEvents.length - 1]) : firstStart
  const totalSeconds = Math.max(AXIS_STEP_SECONDS, Math.ceil((lastStart - firstStart) / 1000) + AXIS_STEP_SECONDS)
  const tracksHeight = sensors.length * ROW_HEIGHT

  const [windowStartRatio, setWindowStartRatio] = useState(1 - DEFAULT_WINDOW_RATIO)
  const [windowWidthRatio, setWindowWidthRatio] = useState(DEFAULT_WINDOW_RATIO)
  const minimapRef = useRef<HTMLDivElement | null>(null)
  const [dragMode, setDragMode] = useState<'move' | 'resize-left' | 'resize-right' | null>(null)
  const dragStartX = useRef(0)
  const dragStartWindowLeft = useRef(0)
  const dragStartWindowWidth = useRef(0)

  const safeWindowWidth = Math.min(1, Math.max(MIN_WINDOW_RATIO, windowWidthRatio))
  const safeWindowStart = Math.min(Math.max(0, windowStartRatio), 1 - safeWindowWidth)

  const viewStartSeconds = totalSeconds * safeWindowStart
  const viewDurationSeconds = totalSeconds * safeWindowWidth
  const viewEndSeconds = viewStartSeconds + viewDurationSeconds
  const zoomPercent = Math.round(safeWindowWidth * 100)
  const viewStartLabel = formatAxisUtc(firstStart + viewStartSeconds * 1000)
  const viewEndLabel = formatAxisUtc(firstStart + viewEndSeconds * 1000)

  const axisLabelStepSeconds = Math.max(
    AXIS_STEP_SECONDS,
    Math.ceil(viewDurationSeconds / MAX_AXIS_LABELS / AXIS_STEP_SECONDS) * AXIS_STEP_SECONDS,
  )

  const axisMarks: { leftPct: number; label: string }[] = []
  for (let seconds = 0; seconds <= viewDurationSeconds; seconds += axisLabelStepSeconds) {
    axisMarks.push({
      leftPct: (seconds / viewDurationSeconds) * 100,
      label: formatAxisUtc(firstStart + (viewStartSeconds + seconds) * 1000),
    })
  }

  const lastMark = axisMarks[axisMarks.length - 1]
  if (!lastMark || Math.abs(lastMark.leftPct - 100) > 0.001) {
    axisMarks.push({
      leftPct: 100,
      label: formatAxisUtc(firstStart + viewEndSeconds * 1000),
    })
  }

  useEffect(() => {
    if (!dragMode) {
      return
    }

    const onMouseMove = (event: MouseEvent) => {
      const minimap = minimapRef.current
      if (!minimap) {
        return
      }

      const width = minimap.getBoundingClientRect().width
      if (width <= 0) {
        return
      }

      const deltaRatio = (event.clientX - dragStartX.current) / width

      if (dragMode === 'move') {
        const nextStart = Math.min(
          Math.max(0, dragStartWindowLeft.current + deltaRatio),
          1 - dragStartWindowWidth.current,
        )
        setWindowStartRatio(nextStart)
        return
      }

      if (dragMode === 'resize-left') {
        const rightEdge = dragStartWindowLeft.current + dragStartWindowWidth.current
        const nextStart = Math.min(
          Math.max(0, dragStartWindowLeft.current + deltaRatio),
          rightEdge - MIN_WINDOW_RATIO,
        )
        const nextWidth = rightEdge - nextStart
        setWindowStartRatio(nextStart)
        setWindowWidthRatio(Math.max(MIN_WINDOW_RATIO, nextWidth))
        return
      }

      const maxWidth = 1 - dragStartWindowLeft.current
      const nextWidth = Math.min(
        Math.max(MIN_WINDOW_RATIO, dragStartWindowWidth.current + deltaRatio),
        maxWidth,
      )
      setWindowWidthRatio(nextWidth)
    }

    const onMouseUp = () => {
      setDragMode(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragMode])

  const startDrag = (mode: 'move' | 'resize-left' | 'resize-right') => (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragMode(mode)
    dragStartX.current = event.clientX
    dragStartWindowLeft.current = safeWindowStart
    dragStartWindowWidth.current = safeWindowWidth
  }

  const getMinimapRatio = (clientX: number): number => {
    const minimap = minimapRef.current
    if (!minimap) {
      return 0
    }

    const rect = minimap.getBoundingClientRect()
    if (rect.width <= 0) {
      return 0
    }

    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  const applyZoom = (nextWidth: number) => {
    const clampedWidth = Math.min(1, Math.max(MIN_WINDOW_RATIO, nextWidth))
    const center = safeWindowStart + safeWindowWidth / 2
    const nextStart = Math.min(Math.max(0, center - clampedWidth / 2), 1 - clampedWidth)
    setWindowWidthRatio(clampedWidth)
    setWindowStartRatio(nextStart)
  }

  const zoomIn = () => applyZoom(safeWindowWidth * 0.8)
  const zoomOut = () => applyZoom(safeWindowWidth * 1.2)
  const resetZoom = () => {
    setWindowWidthRatio(DEFAULT_WINDOW_RATIO)
    setWindowStartRatio(1 - DEFAULT_WINDOW_RATIO)
  }
  const jumpToLatest = () => {
    setWindowStartRatio(1 - safeWindowWidth)
  }

  const handleMinimapWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()

    const cursorRatio = getMinimapRatio(event.clientX)
    const focusTimeRatio = safeWindowStart + cursorRatio * safeWindowWidth
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9
    const nextWidth = Math.min(1, Math.max(MIN_WINDOW_RATIO, safeWindowWidth * zoomFactor))
    const cursorShare = safeWindowWidth > 0 ? (focusTimeRatio - safeWindowStart) / safeWindowWidth : 0.5
    const nextStart = Math.min(
      Math.max(0, focusTimeRatio - cursorShare * nextWidth),
      1 - nextWidth,
    )

    setWindowWidthRatio(nextWidth)
    setWindowStartRatio(nextStart)
  }

  const handleMinimapClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (dragMode) {
      return
    }

    const target = event.target as HTMLElement
    if (target.dataset.viewportPart === 'true') {
      return
    }

    const clickRatio = getMinimapRatio(event.clientX)
    const nextStart = Math.min(
      Math.max(0, clickRatio - safeWindowWidth / 2),
      1 - safeWindowWidth,
    )

    setWindowStartRatio(nextStart)
  }

  if (!hasEvents) {
    return (
      <section className="tactical-panel p-4">
        <h2 className="mb-3 text-xs uppercase tracking-[0.26em] text-zinc-400">Event Timeline</h2>
        <p className="py-6 text-sm uppercase tracking-[0.2em] text-zinc-500">No historical events match current filters.</p>
      </section>
    )
  }

  return (
    <section className="tactical-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.26em] text-zinc-400">Event Timeline</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-sm border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-200"
            onClick={zoomIn}
          >
            Zoom In
          </button>
          <button
            type="button"
            className="rounded-sm border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-200"
            onClick={zoomOut}
          >
            Zoom Out
          </button>
          <button
            type="button"
            className="rounded-sm border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-200"
            onClick={resetZoom}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded-sm border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-200"
            onClick={jumpToLatest}
          >
            Latest
          </button>
        </div>
      </div>
      <div className="rounded-sm border border-zinc-700/80 bg-zinc-950/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          <span>Visible Range: {viewStartLabel} - {viewEndLabel}</span>
          <span>Zoom: {zoomPercent}% of full arc</span>
        </div>

        <div className="grid grid-cols-[8rem_minmax(0,1fr)] border-b border-zinc-700/80 bg-zinc-900/80 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          <div className="px-3 py-2">Sensor</div>
          <div className="px-3 py-2">
            <div className="relative h-6 w-full">
              {axisMarks.map((mark, index) => {
                const alignClass = index === 0 ? 'left-0' : index === axisMarks.length - 1 ? 'right-0' : '-translate-x-1/2'

                return (
                  <div
                    key={`mark-${mark.leftPct}-${index}`}
                    className={clsx('absolute top-0', alignClass)}
                    style={index > 0 && index < axisMarks.length - 1 ? { left: `${mark.leftPct}%` } : undefined}
                  >
                    <span className="text-[9px] text-zinc-400">{mark.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-[8rem_minmax(0,1fr)]">
            <div className="border-r border-zinc-700/80 bg-zinc-900/60">
              {sensors.map((sensorId) => (
                <div
                  key={`sensor-${sensorId}`}
                  className="flex items-center border-b border-zinc-800/70 px-3 text-[11px] uppercase tracking-[0.14em] text-zinc-200"
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  {sensorId}
                </div>
              ))}
            </div>

            <div>
              <div
                className="relative w-full bg-[repeating-linear-gradient(to_right,rgba(255,255,255,0.04),rgba(255,255,255,0.04)_1px,transparent_1px,transparent_8.33%)]"
                style={{ height: `${tracksHeight}px` }}
              >
                {sensors.map((sensorId, sensorIndex) => (
                  <div
                    key={`track-line-${sensorId}`}
                    className="absolute left-0 right-0 border-b border-zinc-800/70"
                    style={{ top: `${(sensorIndex + 1) * ROW_HEIGHT}px` }}
                  />
                ))}

                {sensors.map((sensorId, sensorIndex) => {
                  const sensorEvents = groupedBySensor.get(sensorId) ?? []
                  const centerY = sensorIndex * ROW_HEIGHT + ROW_HEIGHT / 2

                  return sensorEvents.map((event) => {
                    const startsAtMs = getStartsAtMs(event)
                    const durationSeconds = getDurationSeconds(event)
                    const eventSecond = Math.round((startsAtMs - firstStart) / 1000)
                    if (eventSecond < viewStartSeconds || eventSecond > viewEndSeconds) {
                      return null
                    }

                    const offsetSeconds = Math.max(0, Math.round(eventSecond - viewStartSeconds))
                    const leftPct = (offsetSeconds / viewDurationSeconds) * 100

                    return (
                      <div
                        key={`point-${event.event_id}`}
                        className={clsx(
                          'group absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2',
                          toneClass[event.classification],
                        )}
                        style={{ left: `${leftPct}%`, top: `${centerY}px` }}
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
                        <span className="pointer-events-none absolute inset-0 animate-pulse rounded-full border border-current opacity-35" />

                        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden w-64 -translate-x-1/2 -translate-y-full rounded-sm border border-zinc-600 bg-zinc-950/95 p-2 text-[11px] tracking-[0.04em] text-zinc-200 shadow-[0_12px_24px_rgba(0,0,0,0.55)] group-hover:block">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">{event.sensor_id}</p>
                          <p className="mt-1">Type: {classificationLabel[event.classification]}</p>
                          <p>Frequency: {event.frequency.toFixed(2)} Hz</p>
                          <p>Amplitude: {event.amplitude?.toFixed(2) ?? 'N/A'}</p>
                          <p className="mt-1 text-zinc-300">Start: {formatUtcTimestamp(event.startsAt ?? event.timestamp)}</p>
                          {durationSeconds ? <p className="text-zinc-300">Duration: {durationSeconds}s</p> : null}
                        </div>
                      </div>
                    )
                  })
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-700/80 px-3 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            <p>Navigator (Zoom & Pan)</p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400" />Earthquake</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Conventional</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Nuclear-like</span>
            </div>
          </div>

          <div
            ref={minimapRef}
            className="relative h-9 rounded-sm border border-zinc-700/80 bg-[linear-gradient(90deg,rgba(34,211,238,0.06),transparent_35%,transparent_65%,rgba(225,29,72,0.06))]"
            onWheel={handleMinimapWheel}
            onClick={handleMinimapClick}
          >
            {orderedEvents.map((event) => {
              const startsAtMs = getStartsAtMs(event)
              const offsetSeconds = Math.round((startsAtMs - firstStart) / 1000)
              const leftPercent = (offsetSeconds / totalSeconds) * 100

              return (
                <span
                  key={`mini-${event.event_id}`}
                  className={clsx('absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full', {
                    'bg-cyan-400': event.classification === 'EARTHQUAKE',
                    'bg-amber-400': event.classification === 'CONVENTIONAL_EXPLOSION',
                    'bg-rose-500': event.classification === 'NUCLEAR_LIKE',
                  })}
                  style={{ left: `${leftPercent}%` }}
                />
              )
            })}

            <div
              className="absolute bottom-0 top-0 cursor-grab rounded-sm border border-cyan-300/80 bg-cyan-400/20 active:cursor-grabbing"
              style={{
                left: `${safeWindowStart * 100}%`,
                width: `${safeWindowWidth * 100}%`,
              }}
              onMouseDown={startDrag('move')}
              data-viewport-part="true"
            >
              <div
                className="absolute bottom-0 left-0 top-0 w-2 cursor-ew-resize border-r border-cyan-200/80 bg-cyan-300/35"
                onMouseDown={(event) => {
                  event.stopPropagation()
                  startDrag('resize-left')(event)
                }}
                data-viewport-part="true"
              />
              <div
                className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize border-l border-cyan-200/80 bg-cyan-300/35"
                onMouseDown={(event) => {
                  event.stopPropagation()
                  startDrag('resize-right')(event)
                }}
                data-viewport-part="true"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
