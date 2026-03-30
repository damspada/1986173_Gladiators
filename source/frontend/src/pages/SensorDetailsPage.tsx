import clsx from 'clsx'
import { divIcon, type LatLngTuple } from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { ZoneNavLink } from '../components/common/ZoneNavLink'
import {
  CLASSIFICATION_BANDS,
  classificationBadgeClass,
  classificationBandPalette,
  classificationLabel,
  isSevereAnomaly,
} from '../utils/classification'
import { formatFrequency, formatUtcTimestamp } from '../utils/format'
import { fetchHistoryEvents } from '../services/historyApi'
import type { SeismicEvent, SensorMeta } from '../types/seismic'

interface SensorDetailsPageProps {
  sensors: SensorMeta[]
  liveEvents: SeismicEvent[]
  onSelectEvent: (event: SeismicEvent) => void
}

interface ChartPoint {
  event: SeismicEvent
  timestampMs: number
}

interface RenderPoint {
  point: ChartPoint
  x: number
  y: number
}

interface FrequencyProfileRow {
  label: string
  count: number
  ratio: number
}

interface SensorSnapshot {
  eventCount: number
  min: number | null
  max: number | null
  avg: number | null
  stdDev: number | null
  latestTimestamp: string | null
  classificationCounts: Record<SeismicEvent['classification'], number>
  profile: FrequencyProfileRow[]
}

const DEFAULT_MAP_CENTER: LatLngTuple = [20, 0]
const DEFAULT_CHART_WINDOW_RATIO = 0.42
const MIN_CHART_WINDOW_RATIO = 0.12
const sensorMapIcon = divIcon({
  className: 'sensor-marker-wrapper',
  html: '<span class="sensor-marker eq is-hot is-hot-eq"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const buildEventKey = (event: SeismicEvent): string => {
  if (event.event_id) {
    return event.event_id
  }

  return `${event.sensor_id}:${event.timestamp}:${event.frequency.toFixed(2)}`
}

const toChartPoints = (events: SeismicEvent[]): ChartPoint[] => {
  return events
    .map((event) => {
      const timestampMs = Date.parse(event.startsAt ?? event.timestamp)
      return {
        event,
        timestampMs,
      }
    })
    .filter((entry) => !Number.isNaN(entry.timestampMs))
    .sort((a, b) => a.timestampMs - b.timestampMs)
}

const mergeEventSources = (events: SeismicEvent[]): SeismicEvent[] => {
  const merged = new Map<string, SeismicEvent>()

  for (const event of events) {
    const key = buildEventKey(event)
    if (!merged.has(key)) {
      merged.set(key, event)
    }
  }

  return [...merged.values()].sort((a, b) => Date.parse(b.startsAt ?? b.timestamp) - Date.parse(a.startsAt ?? a.timestamp))
}

const createSensorSnapshot = (events: SeismicEvent[]): SensorSnapshot => {
  const classificationCounts: Record<SeismicEvent['classification'], number> = {
    EARTHQUAKE: 0,
    CONVENTIONAL_EXPLOSION: 0,
    NUCLEAR_LIKE: 0,
  }

  for (const event of events) {
    classificationCounts[event.classification] += 1
  }

  const eventCount = events.length
  const frequencies = events.map((event) => event.frequency)
  const avg = eventCount > 0 ? frequencies.reduce((sum, value) => sum + value, 0) / eventCount : null
  const variance = eventCount > 0 && avg !== null
    ? frequencies.reduce((sum, value) => sum + (value - avg) ** 2, 0) / eventCount
    : null

  const profile = [
    { label: 'EARTHQUAKE', count: classificationCounts.EARTHQUAKE, ratio: eventCount > 0 ? classificationCounts.EARTHQUAKE / eventCount : 0 },
    { label: 'CONVENTIONAL_EXPLOSION', count: classificationCounts.CONVENTIONAL_EXPLOSION, ratio: eventCount > 0 ? classificationCounts.CONVENTIONAL_EXPLOSION / eventCount : 0 },
    { label: 'NUCLEAR_LIKE', count: classificationCounts.NUCLEAR_LIKE, ratio: eventCount > 0 ? classificationCounts.NUCLEAR_LIKE / eventCount : 0 },
  ]

  return {
    eventCount,
    min: eventCount > 0 ? Math.min(...frequencies) : null,
    max: eventCount > 0 ? Math.max(...frequencies) : null,
    avg,
    stdDev: variance !== null ? Math.sqrt(variance) : null,
    latestTimestamp: eventCount > 0 ? (events[0].startsAt ?? events[0].timestamp) : null,
    classificationCounts,
    profile,
  }
}

export const SensorDetailsPage = ({ sensors, liveEvents, onSelectEvent }: SensorDetailsPageProps) => {
  const { sensorId: rawSensorId } = useParams()
  const sensorId = useMemo(() => decodeURIComponent(rawSensorId ?? '').trim(), [rawSensorId])
  const [historyEvents, setHistoryEvents] = useState<SeismicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [windowStartRatio, setWindowStartRatio] = useState(1 - DEFAULT_CHART_WINDOW_RATIO)
  const [windowWidthRatio, setWindowWidthRatio] = useState(DEFAULT_CHART_WINDOW_RATIO)
  const [showMovingAverage, setShowMovingAverage] = useState(true)
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const [compareSensorId, setCompareSensorId] = useState('')
  const [compareHistoryEvents, setCompareHistoryEvents] = useState<SeismicEvent[]>([])
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const chartSvgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!sensorId) {
      setHistoryEvents([])
      setLoading(false)
      return
    }

    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await fetchHistoryEvents({
          type: 'ALL',
          sensorId,
          region: '',
        }, { limit: 300, offset: 0 })

        if (!active) {
          return
        }

        setHistoryEvents(result.events.filter((event) => event.sensor_id === sensorId))
      } catch (err: unknown) {
        if (!active) {
          return
        }

        setHistoryEvents([])
        setError(err instanceof Error ? err.message : 'Unable to load sensor history.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [sensorId])

  const liveSensorEvents = useMemo(
    () => liveEvents.filter((event) => event.sensor_id === sensorId),
    [liveEvents, sensorId],
  )

  const allEvents = useMemo(() => mergeEventSources([...liveSensorEvents, ...historyEvents]), [historyEvents, liveSensorEvents])

  const chartPoints = useMemo(() => toChartPoints([...allEvents].reverse()), [allEvents])

  useEffect(() => {
    setWindowStartRatio(1 - DEFAULT_CHART_WINDOW_RATIO)
    setWindowWidthRatio(DEFAULT_CHART_WINDOW_RATIO)
    setHoveredEventId(null)
  }, [sensorId])

  const knownSensor = useMemo(() => sensors.find((sensor) => sensor.sensor_id === sensorId), [sensors, sensorId])

  const comparableSensors = useMemo(
    () => sensors.filter((sensor) => sensor.sensor_id !== sensorId).sort((a, b) => a.sensor_id.localeCompare(b.sensor_id)),
    [sensorId, sensors],
  )

  useEffect(() => {
    if (comparableSensors.length === 0) {
      setCompareSensorId('')
      return
    }

    const stillValid = comparableSensors.some((sensor) => sensor.sensor_id === compareSensorId)
    if (!stillValid) {
      setCompareSensorId(comparableSensors[0].sensor_id)
    }
  }, [comparableSensors, compareSensorId])

  useEffect(() => {
    if (!compareSensorId) {
      setCompareHistoryEvents([])
      setCompareError(null)
      return
    }

    let active = true

    const loadCompare = async () => {
      setCompareLoading(true)
      setCompareError(null)

      try {
        const result = await fetchHistoryEvents({
          type: 'ALL',
          sensorId: compareSensorId,
          region: '',
        }, { limit: 300, offset: 0 })

        if (!active) {
          return
        }

        setCompareHistoryEvents(result.events.filter((event) => event.sensor_id === compareSensorId))
      } catch (err: unknown) {
        if (!active) {
          return
        }

        setCompareHistoryEvents([])
        setCompareError(err instanceof Error ? err.message : 'Unable to load comparison sensor history.')
      } finally {
        if (active) {
          setCompareLoading(false)
        }
      }
    }

    void loadCompare()

    return () => {
      active = false
    }
  }, [compareSensorId])

  const inferredSensor = useMemo(() => {
    for (const event of allEvents) {
      if (event.sensor) {
        return event.sensor
      }
    }

    return undefined
  }, [allEvents])

  const sensorMeta = knownSensor ?? inferredSensor
  const mapCenter = sensorMeta ? ([sensorMeta.lat, sensorMeta.long] as LatLngTuple) : DEFAULT_MAP_CENTER

  const liveCompareEvents = useMemo(
    () => liveEvents.filter((event) => event.sensor_id === compareSensorId),
    [compareSensorId, liveEvents],
  )

  const compareAllEvents = useMemo(
    () => mergeEventSources([...liveCompareEvents, ...compareHistoryEvents]),
    [compareHistoryEvents, liveCompareEvents],
  )

  const primarySnapshot = useMemo(() => createSensorSnapshot(allEvents), [allEvents])
  const compareSnapshot = useMemo(() => createSensorSnapshot(compareAllEvents), [compareAllEvents])

  const comparisonDelta = useMemo(() => {
    if (!compareSensorId) {
      return null
    }

    const countDelta = primarySnapshot.eventCount - compareSnapshot.eventCount
    const avgDelta = primarySnapshot.avg !== null && compareSnapshot.avg !== null
      ? primarySnapshot.avg - compareSnapshot.avg
      : null
    const typeDelta = Math.abs((primarySnapshot.classificationCounts.EARTHQUAKE - compareSnapshot.classificationCounts.EARTHQUAKE)) +
      Math.abs((primarySnapshot.classificationCounts.CONVENTIONAL_EXPLOSION - compareSnapshot.classificationCounts.CONVENTIONAL_EXPLOSION)) +
      Math.abs((primarySnapshot.classificationCounts.NUCLEAR_LIKE - compareSnapshot.classificationCounts.NUCLEAR_LIKE))

    const anomalyLevel = Math.abs(countDelta) >= 120 || typeDelta >= 100 || (avgDelta !== null && Math.abs(avgDelta) >= 2)
      ? 'high'
      : Math.abs(countDelta) >= 60 || typeDelta >= 50 || (avgDelta !== null && Math.abs(avgDelta) >= 1)
        ? 'moderate'
        : 'low'

    return {
      countDelta,
      avgDelta,
      typeDelta,
      anomalyLevel,
    }
  }, [compareSensorId, compareSnapshot, primarySnapshot])

  const frequencyStats = useMemo(() => {
    if (allEvents.length === 0) {
      return null
    }

    const values = allEvents.map((event) => event.frequency)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length

    return {
      min,
      max,
      avg,
    }
  }, [allEvents])

  const totalDurationMs = useMemo(() => {
    if (chartPoints.length < 2) {
      return 0
    }

    return chartPoints[chartPoints.length - 1].timestampMs - chartPoints[0].timestampMs
  }, [chartPoints])

  const canWindow = chartPoints.length > 4 && totalDurationMs > 0
  const safeWindowWidth = canWindow ? Math.min(1, Math.max(MIN_CHART_WINDOW_RATIO, windowWidthRatio)) : 1
  const safeWindowStart = canWindow ? Math.min(Math.max(0, windowStartRatio), 1 - safeWindowWidth) : 0

  const visibleWindowMs = useMemo(() => {
    if (chartPoints.length === 0) {
      return null
    }

    const minTs = chartPoints[0].timestampMs
    const maxTs = chartPoints[chartPoints.length - 1].timestampMs
    const span = Math.max(1, maxTs - minTs)
    const startMs = minTs + span * safeWindowStart
    const endMs = startMs + span * safeWindowWidth

    return {
      startMs,
      endMs,
      minTs,
      maxTs,
      span,
    }
  }, [chartPoints, safeWindowStart, safeWindowWidth])

  const visiblePoints = useMemo(() => {
    if (!visibleWindowMs) {
      return chartPoints
    }

    return chartPoints.filter((entry) => entry.timestampMs >= visibleWindowMs.startMs && entry.timestampMs <= visibleWindowMs.endMs)
  }, [chartPoints, visibleWindowMs])

  const chartModel = useMemo(() => {
    if (visiblePoints.length === 0) {
      return null
    }

    const width = 920
    const height = 250
    const paddingX = 34
    const paddingY = 20

    const minX = visiblePoints[0].timestampMs
    const maxX = visiblePoints[visiblePoints.length - 1].timestampMs
    const minY = Math.min(...visiblePoints.map((point) => point.event.frequency))
    const maxY = Math.max(...visiblePoints.map((point) => point.event.frequency))

    const xSpan = Math.max(1, maxX - minX)
    const ySpan = Math.max(0.5, maxY - minY)
    const plotWidth = width - paddingX * 2
    const plotHeight = height - paddingY * 2

    const toX = (timestampMs: number) => paddingX + ((timestampMs - minX) / xSpan) * plotWidth
    const toY = (value: number) => height - paddingY - ((value - minY) / ySpan) * plotHeight

    const renderPoints: RenderPoint[] = visiblePoints.map((point) => ({
      point,
      x: toX(point.timestampMs),
      y: toY(point.event.frequency),
    }))

    const pathD = renderPoints
      .map((entry, index) => `${index === 0 ? 'M' : 'L'} ${entry.x.toFixed(2)} ${entry.y.toFixed(2)}`)
      .join(' ')

    const movingAveragePathD = showMovingAverage && renderPoints.length > 2
      ? renderPoints
          .map((entry, index) => {
            const from = Math.max(0, index - 2)
            const to = Math.min(renderPoints.length - 1, index + 2)
            let sum = 0
            for (let cursor = from; cursor <= to; cursor += 1) {
              sum += renderPoints[cursor].point.event.frequency
            }
            const avg = sum / (to - from + 1)
            const cmd = index === 0 ? 'M' : 'L'
            return `${cmd} ${entry.x.toFixed(2)} ${toY(avg).toFixed(2)}`
          })
          .join(' ')
      : null

    const yGrid = Array.from({ length: 4 }).map((_, index) => {
      const ratio = index / 3
      const y = paddingY + ratio * plotHeight
      const value = maxY - ratio * ySpan
      return {
        y,
        value,
      }
    })

    return {
      width,
      height,
      paddingX,
      paddingY,
      minY,
      maxY,
      pathD,
      movingAveragePathD,
      toX,
      toY,
      renderPoints,
      yGrid,
    }
  }, [showMovingAverage, visiblePoints])

  const hoveredPoint = useMemo(() => {
    if (!chartModel || !hoveredEventId) {
      return null
    }

    return chartModel.renderPoints.find((entry) => entry.point.event.event_id === hoveredEventId) ?? null
  }, [chartModel, hoveredEventId])

  const visibleStats = useMemo(() => {
    if (visiblePoints.length === 0) {
      return null
    }

    const frequencies = visiblePoints.map((entry) => entry.event.frequency)
    const min = Math.min(...frequencies)
    const max = Math.max(...frequencies)
    const avg = frequencies.reduce((sum, value) => sum + value, 0) / frequencies.length
    const variance = frequencies.reduce((sum, value) => sum + (value - avg) ** 2, 0) / frequencies.length
    const stdDev = Math.sqrt(variance)

    const first = visiblePoints[0]
    const last = visiblePoints[visiblePoints.length - 1]
    const delta = last.event.frequency - first.event.frequency
    const durationHours = Math.max(1 / 3600, (last.timestampMs - first.timestampMs) / 3_600_000)
    const trendPerHour = delta / durationHours

    return {
      min,
      max,
      avg,
      stdDev,
      delta,
      trendPerHour,
      count: visiblePoints.length,
    }
  }, [visiblePoints])

  const setWindowFromMinutes = (minutes: number) => {
    if (!canWindow || totalDurationMs <= 0) {
      return
    }

    const width = Math.min(1, Math.max(MIN_CHART_WINDOW_RATIO, (minutes * 60_000) / totalDurationMs))
    setWindowWidthRatio(width)
    setWindowStartRatio(1 - width)
  }

  const zoomWindow = (factor: number) => {
    if (!canWindow) {
      return
    }

    const nextWidth = Math.min(1, Math.max(MIN_CHART_WINDOW_RATIO, safeWindowWidth * factor))
    const center = safeWindowStart + safeWindowWidth / 2
    const nextStart = Math.min(Math.max(0, center - nextWidth / 2), 1 - nextWidth)
    setWindowWidthRatio(nextWidth)
    setWindowStartRatio(nextStart)
  }

  const panWindow = (deltaRatio: number) => {
    if (!canWindow) {
      return
    }

    const nextStart = Math.min(Math.max(0, safeWindowStart + deltaRatio), 1 - safeWindowWidth)
    setWindowStartRatio(nextStart)
  }

  const resetWindow = () => {
    if (!canWindow) {
      setWindowStartRatio(0)
      setWindowWidthRatio(1)
      return
    }

    setWindowWidthRatio(DEFAULT_CHART_WINDOW_RATIO)
    setWindowStartRatio(1 - DEFAULT_CHART_WINDOW_RATIO)
  }

  const jumpLatest = () => {
    if (!canWindow) {
      return
    }

    setWindowStartRatio(1 - safeWindowWidth)
  }

  const handleChartMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!chartModel || !chartSvgRef.current) {
      return
    }

    const rect = chartSvgRef.current.getBoundingClientRect()
    if (rect.width === 0 || chartModel.renderPoints.length === 0) {
      return
    }

    const x = ((event.clientX - rect.left) / rect.width) * chartModel.width
    let nearest = chartModel.renderPoints[0]

    for (const entry of chartModel.renderPoints) {
      if (Math.abs(entry.x - x) < Math.abs(nearest.x - x)) {
        nearest = entry
      }
    }

    setHoveredEventId(nearest.point.event.event_id)
  }

  const handleChartLeave = () => {
    setHoveredEventId(null)
  }

  if (!sensorId) {
    return (
      <section className="tactical-panel p-4">
        <p className="text-sm uppercase tracking-[0.16em] text-rose-300">Invalid sensor identifier.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <section className="tactical-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Sensor Dossier</p>
            <h2 className="mt-1 text-xl uppercase tracking-[0.18em] text-zinc-100">{sensorId}</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-400">
              {sensorMeta?.region ? (
                <ZoneNavLink zone={sensorMeta.region} className="px-0 py-0 text-zinc-400 hover:text-cyan-200" />
              ) : (
                'Region unavailable'
              )}
            </p>
          </div>
          <Link
            to="/live"
            className="rounded-sm border border-zinc-600 bg-zinc-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300 transition hover:border-cyan-400/70 hover:text-cyan-200"
          >
            Back To Live
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <div className="tactical-panel p-4">
          <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-400">
            <span>Frequency Over Time</span>
            <span>{allEvents.length} events</span>
          </div>

          <div className="mb-3 overflow-x-auto rounded-sm border border-zinc-700/80 bg-zinc-900/50 p-2 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
            <div className="grid min-w-[38rem] gap-2 md:grid-cols-[auto_auto_auto_auto_1fr_auto]">
            <button type="button" className="rounded-sm border border-zinc-600 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={() => panWindow(-0.1)}>
              Pan -
            </button>
            <button type="button" className="rounded-sm border border-zinc-600 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={() => panWindow(0.1)}>
              Pan +
            </button>
            <button type="button" className="rounded-sm border border-zinc-600 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={() => zoomWindow(0.75)}>
              Zoom In
            </button>
            <button type="button" className="rounded-sm border border-zinc-600 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={() => zoomWindow(1.25)}>
              Zoom Out
            </button>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" className="rounded-sm border border-zinc-700 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={() => setWindowFromMinutes(15)}>15m</button>
              <button type="button" className="rounded-sm border border-zinc-700 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={() => setWindowFromMinutes(60)}>1h</button>
              <button type="button" className="rounded-sm border border-zinc-700 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={() => setWindowFromMinutes(360)}>6h</button>
              <button type="button" className="rounded-sm border border-zinc-700 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={() => {
                setWindowStartRatio(0)
                setWindowWidthRatio(1)
              }}>All</button>
            </div>
            <div className="flex justify-end gap-1">
              <button type="button" className="rounded-sm border border-zinc-700 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={jumpLatest}>Latest</button>
              <button type="button" className="rounded-sm border border-zinc-700 px-2 py-1 hover:border-cyan-400/70 hover:text-cyan-200" onClick={resetWindow}>Reset</button>
              <button
                type="button"
                className={clsx(
                  'rounded-sm border px-2 py-1 transition',
                  showMovingAverage ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-200' : 'border-zinc-700 hover:border-cyan-400/70 hover:text-cyan-200',
                )}
                onClick={() => setShowMovingAverage((value) => !value)}
              >
                MA(5)
              </button>
            </div>
            </div>
          </div>

          {visibleWindowMs ? (
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
              Window: {formatUtcTimestamp(new Date(visibleWindowMs.startMs).toISOString())} - {formatUtcTimestamp(new Date(visibleWindowMs.endMs).toISOString())}
            </p>
          ) : null}

          {chartModel && visiblePoints.length > 1 ? (
            <div className="rounded-sm border border-zinc-700/80 bg-zinc-950/70 p-2">
              <svg
                ref={chartSvgRef}
                viewBox={`0 0 ${chartModel.width} ${chartModel.height}`}
                className="h-[14rem] w-full sm:h-[16rem]"
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartLeave}
              >
                {chartModel.yGrid.map((line) => (
                  <g key={`grid-${line.y}`}>
                    <line x1={24} y1={line.y} x2={chartModel.width - 24} y2={line.y} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
                    <text x={6} y={line.y + 4} fill="rgba(148,163,184,0.72)" fontSize="10">
                      {line.value.toFixed(1)}
                    </text>
                  </g>
                ))}

                {[
                  { key: 'EARTHQUAKE', from: CLASSIFICATION_BANDS.EARTHQUAKE.min, to: CLASSIFICATION_BANDS.EARTHQUAKE.max },
                  { key: 'CONVENTIONAL_EXPLOSION', from: CLASSIFICATION_BANDS.CONVENTIONAL_EXPLOSION.min, to: CLASSIFICATION_BANDS.CONVENTIONAL_EXPLOSION.max },
                  { key: 'NUCLEAR_LIKE', from: CLASSIFICATION_BANDS.NUCLEAR_LIKE.min, to: Math.max(chartModel.maxY, CLASSIFICATION_BANDS.NUCLEAR_LIKE.min + 0.5) },
                ].map((band) => {
                  const visibleFrom = Math.max(chartModel.minY, band.from)
                  const visibleTo = Math.min(chartModel.maxY, band.to)
                  if (visibleTo <= visibleFrom) {
                    return null
                  }

                  const yTop = chartModel.toY(visibleTo)
                  const yBottom = chartModel.toY(visibleFrom)
                  return (
                    <rect
                      key={`band-${band.key}`}
                      x={chartModel.paddingX}
                      y={Math.min(yTop, yBottom)}
                      width={chartModel.width - chartModel.paddingX * 2}
                      height={Math.abs(yBottom - yTop)}
                      fill={classificationBandPalette[band.key as keyof typeof classificationBandPalette]}
                    />
                  )
                })}

                <path d={chartModel.pathD} fill="none" stroke="rgba(34,211,238,0.95)" strokeWidth="2.5" />

                {chartModel.movingAveragePathD ? (
                  <path d={chartModel.movingAveragePathD} fill="none" stroke="rgba(245,158,11,0.9)" strokeDasharray="4 3" strokeWidth="2" />
                ) : null}

                {hoveredPoint ? (
                  <>
                    <line x1={hoveredPoint.x} y1={chartModel.paddingY} x2={hoveredPoint.x} y2={chartModel.height - chartModel.paddingY} stroke="rgba(16,185,129,0.6)" strokeWidth="1.2" strokeDasharray="3 3" />
                    <line x1={chartModel.paddingX} y1={hoveredPoint.y} x2={chartModel.width - chartModel.paddingX} y2={hoveredPoint.y} stroke="rgba(16,185,129,0.4)" strokeWidth="1" strokeDasharray="3 3" />
                  </>
                ) : null}

                {chartModel.renderPoints.map((entry, index) => {
                  const isLatest = index === chartModel.renderPoints.length - 1
                  const isHovered = hoveredPoint?.point.event.event_id === entry.point.event.event_id
                  return (
                    <circle
                      key={`point-${entry.point.event.event_id}-${index}`}
                      cx={entry.x}
                      cy={entry.y}
                      r={isHovered ? 5.2 : (isLatest ? 4.5 : 2.6)}
                      fill={
                        isHovered
                          ? 'rgba(250,204,21,0.98)'
                          : isSevereAnomaly(entry.point.event.frequency, entry.point.event.severity)
                            ? 'rgba(225,29,72,0.95)'
                            : (isLatest ? 'rgba(16,185,129,0.98)' : 'rgba(125,211,252,0.94)')
                      }
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredEventId(entry.point.event.event_id)}
                      onClick={() => onSelectEvent(entry.point.event)}
                    />
                  )
                })}
              </svg>

              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Bands: cyan earthquake, amber conventional, rose nuclear-like. Red markers highlight severe anomalies.
              </p>

              <div className="mt-2 grid gap-2 rounded-sm border border-zinc-700/70 bg-zinc-900/50 p-2 text-[10px] uppercase tracking-[0.14em] text-zinc-300 md:grid-cols-4">
                <div>
                  <p className="text-zinc-400">Visible points</p>
                  <p className="mt-1 text-cyan-200">{visibleStats?.count ?? 0}</p>
                </div>
                <div>
                  <p className="text-zinc-400">Avg / StdDev</p>
                  <p className="mt-1 text-cyan-200">{visibleStats ? `${visibleStats.avg.toFixed(2)} / ${visibleStats.stdDev.toFixed(2)} Hz` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-zinc-400">Delta (first-last)</p>
                  <p className={clsx('mt-1', visibleStats && visibleStats.delta >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                    {visibleStats ? `${visibleStats.delta >= 0 ? '+' : ''}${visibleStats.delta.toFixed(2)} Hz` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-400">Trend / hour</p>
                  <p className={clsx('mt-1', visibleStats && visibleStats.trendPerHour >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                    {visibleStats ? `${visibleStats.trendPerHour >= 0 ? '+' : ''}${visibleStats.trendPerHour.toFixed(2)} Hz/h` : 'N/A'}
                  </p>
                </div>
              </div>

              {hoveredPoint ? (
                <div className="mt-2 rounded-sm border border-cyan-700/60 bg-cyan-950/15 p-2 text-[10px] uppercase tracking-[0.14em] text-cyan-100">
                  Inspecting: {formatUtcTimestamp(hoveredPoint.point.event.startsAt ?? hoveredPoint.point.event.timestamp)} | {formatFrequency(hoveredPoint.point.event.frequency)} | {classificationLabel[hoveredPoint.point.event.classification]}
                </div>
              ) : (
                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">Hover points to inspect timestamp, frequency and classification.</p>
              )}
            </div>
          ) : (
            <div className="flex h-[16rem] items-center justify-center rounded-sm border border-zinc-700/80 bg-zinc-950/70 text-center text-xs uppercase tracking-[0.14em] text-zinc-500">
              {loading ? 'Loading sensor data...' : 'Not enough points to draw trend chart yet.'}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="tactical-panel p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-400">Sensor Position</div>
            <div className="h-[13rem] overflow-hidden rounded-sm border border-zinc-700/80 sm:h-[16rem]">
              <MapContainer
                center={mapCenter}
                zoom={sensorMeta ? 5 : 2}
                scrollWheelZoom={false}
                dragging
                zoomControl={false}
                className="sensor-world-map h-full w-full"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {sensorMeta ? <Marker position={[sensorMeta.lat, sensorMeta.long]} icon={sensorMapIcon} /> : null}
              </MapContainer>
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              {sensorMeta ? `Lat ${sensorMeta.lat.toFixed(2)} / Lon ${sensorMeta.long.toFixed(2)}` : 'Coordinates unavailable'}
            </div>
          </section>

          <section className="tactical-panel p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-400">Signal Stats</div>
            {frequencyStats ? (
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] uppercase tracking-[0.12em]">
                <div className="rounded-sm border border-zinc-700 bg-zinc-900/70 p-2">
                  <p className="text-zinc-400">Min</p>
                  <p className="mt-1 text-cyan-300">{formatFrequency(frequencyStats.min)}</p>
                </div>
                <div className="rounded-sm border border-zinc-700 bg-zinc-900/70 p-2">
                  <p className="text-zinc-400">Avg</p>
                  <p className="mt-1 text-cyan-300">{formatFrequency(frequencyStats.avg)}</p>
                </div>
                <div className="rounded-sm border border-zinc-700 bg-zinc-900/70 p-2">
                  <p className="text-zinc-400">Max</p>
                  <p className="mt-1 text-cyan-300">{formatFrequency(frequencyStats.max)}</p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">No stats available for this sensor.</p>
            )}

            {error ? (
              <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-rose-300">{error}</p>
            ) : null}
          </section>


        </div>
      </section>

      <section className="tactical-panel p-4">
        <div className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-400">Sensor Event Log</div>
        <div className="overflow-x-auto rounded-sm border border-zinc-700/90">
          <div className="min-w-[34rem]">
            <div className="grid grid-cols-[1.6fr_0.8fr_1.2fr] bg-zinc-900 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              <span>Timestamp (UTC)</span>
              <span>Frequency</span>
              <span>Classification</span>
            </div>
            <div className="max-h-[18rem] overflow-y-auto bg-zinc-950/70">
            {loading ? (
              <p className="px-3 py-8 text-center text-xs uppercase tracking-[0.14em] text-zinc-500">Loading sensor events...</p>
            ) : allEvents.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs uppercase tracking-[0.14em] text-zinc-500">No events available for this sensor.</p>
            ) : (
              allEvents.map((event) => (
                <button
                  key={event.event_id}
                  type="button"
                  className="grid w-full grid-cols-[1.6fr_0.8fr_1.2fr] items-center border-b border-zinc-800/70 px-3 py-2 text-left text-xs text-zinc-200 transition hover:bg-zinc-900/40"
                  onClick={() => onSelectEvent(event)}
                >
                  <span className="text-zinc-300">{formatUtcTimestamp(event.startsAt ?? event.timestamp)}</span>
                  <span>{formatFrequency(event.frequency)}</span>
                  <span
                    className={clsx(
                      'inline-flex max-w-fit rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.08em]',
                      classificationBadgeClass[event.classification],
                    )}
                  >
                    {classificationLabel[event.classification]}
                  </span>
                </button>
              ))
            )}
            </div>
          </div>
        </div>
      </section>

      <section className="tactical-panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-zinc-400">
          <span>Compare Two Sensor Sessions</span>
          {comparableSensors.length > 0 ? (
            <select
              value={compareSensorId}
              onChange={(event) => setCompareSensorId(event.target.value)}
              className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-zinc-200 outline-none focus:border-cyan-500/60"
            >
              {comparableSensors.map((sensor) => (
                <option key={sensor.sensor_id} value={sensor.sensor_id}>{sensor.sensor_id}</option>
              ))}
            </select>
          ) : null}
        </div>

        {comparableSensors.length === 0 ? (
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">No secondary sensors available for comparison.</p>
        ) : compareLoading ? (
          <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Loading comparison sensor history...</p>
        ) : compareError ? (
          <p className="text-[10px] uppercase tracking-[0.14em] text-rose-300">{compareError}</p>
        ) : (
          <>
            <div className="mb-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-400">Primary: {sensorId}</p>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="rounded-sm border border-cyan-600/50 bg-cyan-500/10 p-2">
                    <p className="text-[9px] text-cyan-300">EQK</p>
                    <p className="mt-1 text-sm font-semibold text-cyan-200">{primarySnapshot.classificationCounts.EARTHQUAKE}</p>
                  </div>
                  <div className="rounded-sm border border-amber-600/50 bg-amber-500/10 p-2">
                    <p className="text-[9px] text-amber-300">EXP</p>
                    <p className="mt-1 text-sm font-semibold text-amber-200">{primarySnapshot.classificationCounts.CONVENTIONAL_EXPLOSION}</p>
                  </div>
                  <div className="rounded-sm border border-rose-600/50 bg-rose-500/10 p-2">
                    <p className="text-[9px] text-rose-300">NUC</p>
                    <p className="mt-1 text-sm font-semibold text-rose-200">{primarySnapshot.classificationCounts.NUCLEAR_LIKE}</p>
                  </div>
                </div>
              </div>
              {compareSensorId && compareSnapshot.eventCount > 0 ? (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-400">Compare: {compareSensorId}</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="rounded-sm border border-cyan-600/50 bg-cyan-500/10 p-2">
                      <p className="text-[9px] text-cyan-300">EQK</p>
                      <p className="mt-1 text-sm font-semibold text-cyan-200">{compareSnapshot.classificationCounts.EARTHQUAKE}</p>
                    </div>
                    <div className="rounded-sm border border-amber-600/50 bg-amber-500/10 p-2">
                      <p className="text-[9px] text-amber-300">EXP</p>
                      <p className="mt-1 text-sm font-semibold text-amber-200">{compareSnapshot.classificationCounts.CONVENTIONAL_EXPLOSION}</p>
                    </div>
                    <div className="rounded-sm border border-rose-600/50 bg-rose-500/10 p-2">
                      <p className="text-[9px] text-rose-300">NUC</p>
                      <p className="mt-1 text-sm font-semibold text-rose-200">{compareSnapshot.classificationCounts.NUCLEAR_LIKE}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {comparisonDelta && (
              <div className="mb-3 rounded-sm border border-zinc-700/80 bg-zinc-900/50 p-2 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                <p>
                  Event delta: <span className={clsx(comparisonDelta.countDelta >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                    {comparisonDelta.countDelta >= 0 ? '+' : ''}{comparisonDelta.countDelta}
                  </span>
                </p>
                <p>
                  Avg frequency delta: <span className={clsx(comparisonDelta.avgDelta !== null && comparisonDelta.avgDelta >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                    {comparisonDelta.avgDelta !== null
                      ? `${comparisonDelta.avgDelta >= 0 ? '+' : ''}${comparisonDelta.avgDelta.toFixed(2)} Hz`
                      : 'N/A'}
                  </span>
                </p>
                <p>
                  Anomaly level: <span className={clsx(
                    comparisonDelta.anomalyLevel === 'high'
                      ? 'text-rose-300'
                      : comparisonDelta.anomalyLevel === 'moderate'
                        ? 'text-amber-300'
                        : 'text-emerald-300',
                  )}>
                    {comparisonDelta.anomalyLevel}
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              {primarySnapshot.profile.map((row, index) => {
                const compareRow = compareSnapshot.profile[index]
                const isEarthquake = row.label === 'EARTHQUAKE'
                const isExplosion = row.label === 'CONVENTIONAL_EXPLOSION'
                const isNuclear = row.label === 'NUCLEAR_LIKE'
                const barColor = isEarthquake ? 'bg-cyan-400/80' : isExplosion ? 'bg-amber-400/80' : 'bg-rose-400/80'
                const labelShort = isEarthquake ? 'Earthquake' : isExplosion ? 'Conventional' : 'Nuclear-like'

                return (
                  <div key={row.label} className="rounded-sm border border-zinc-700/70 bg-zinc-900/40 p-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400">{labelShort}</p>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                          <span className="text-zinc-400">{sensorId}</span>
                          <span className="font-semibold text-zinc-100">{row.count}</span>
                        </div>
                        <div className="mt-1.5 h-3 rounded bg-zinc-800">
                          <div className={`h-full rounded ${barColor} ${isNuclear ? 'shadow' : ''}`} style={{ width: `${row.ratio * 100}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                          <span className="text-zinc-400">{compareSensorId}</span>
                          <span className="font-semibold text-zinc-100">{compareRow.count}</span>
                        </div>
                        <div className="mt-1.5 h-3 rounded bg-zinc-800">
                          <div className={`h-full rounded ${barColor} ${isNuclear ? 'shadow' : ''}`} style={{ width: `${compareRow.ratio * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
    </section>
  )
}