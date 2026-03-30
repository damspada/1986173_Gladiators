import { divIcon, latLngBounds, type LatLngTuple } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { ZoneNavLink } from '../common/ZoneNavLink'
import type { SeismicEvent, SensorMeta } from '../../types/seismic'

interface SensorGridMapProps {
  sensors: SensorMeta[]
  latestEvents: SeismicEvent[]
  onSelectSensor?: (sensorId: string) => void
}

const DEFAULT_CENTER: LatLngTuple = [20, 0]
const DEFAULT_ZOOM = 2
const WORLD_BOUNDS: [LatLngTuple, LatLngTuple] = [[-85, -180], [85, 180]]
const MAP_IDLE_RESET_MS = 5000

const CLASS_COLOR: Record<SeismicEvent['classification'], string> = {
  EARTHQUAKE: 'eq',
  CONVENTIONAL_EXPLOSION: 'exp',
  NUCLEAR_LIKE: 'nuc',
}

const CLASS_HEX: Record<SeismicEvent['classification'], string> = {
  EARTHQUAKE: '#22d3ee',
  CONVENTIONAL_EXPLOSION: '#f59e0b',
  NUCLEAR_LIKE: '#e11d48',
}

const SensorBounds = ({ sensors }: { sensors: SensorMeta[] }) => {
  const map = useMap()
  const resetTimerRef = useRef<number | null>(null)
  const hasInitialFitRef = useRef(false)
  const skipNextIdleScheduleRef = useRef(false)

  useEffect(() => {
    if (sensors.length === 0) {
      return
    }

    if (!hasInitialFitRef.current) {
      const bounds = latLngBounds(sensors.map((sensor) => [sensor.lat, sensor.long] as LatLngTuple))
      skipNextIdleScheduleRef.current = true
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5, animate: false })
      hasInitialFitRef.current = true
    }
  }, [map, sensors])

  useEffect(() => {
    const clearResetTimer = () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }

    const scheduleReset = () => {
      if (sensors.length === 0) {
        return
      }

      if (skipNextIdleScheduleRef.current) {
        skipNextIdleScheduleRef.current = false
        return
      }

      clearResetTimer()
      resetTimerRef.current = window.setTimeout(() => {
        const bounds = latLngBounds(sensors.map((sensor) => [sensor.lat, sensor.long] as LatLngTuple))
        skipNextIdleScheduleRef.current = true
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5, animate: true })
      }, MAP_IDLE_RESET_MS)
    }

    map.on('zoomstart', clearResetTimer)
    map.on('movestart', clearResetTimer)
    map.on('zoomend', scheduleReset)
    map.on('moveend', scheduleReset)

    return () => {
      clearResetTimer()
      map.off('zoomstart', clearResetTimer)
      map.off('movestart', clearResetTimer)
      map.off('zoomend', scheduleReset)
      map.off('moveend', scheduleReset)
    }
  }, [map, sensors])

  return null
}

const buildSensorIcon = (isHot: boolean, tone: string) => {
  return divIcon({
    className: 'sensor-marker-wrapper',
    html: `<span class="sensor-marker ${tone} ${isHot ? `is-hot is-hot-${tone}` : ''}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export const SensorGridMap = ({ sensors, latestEvents, onSelectSensor }: SensorGridMapProps) => {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [isPaused, setIsPaused] = useState(false)
  const [displayedEvents, setDisplayedEvents] = useState<SeismicEvent[]>(latestEvents)
  const hotSensors = new Set(displayedEvents.slice(0, 20).map((event) => event.sensor_id))
  const latestBySensor = new Map<string, SeismicEvent>()

  useEffect(() => {
    if (isPaused) {
      return
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 900)

    return () => {
      window.clearInterval(timer)
    }
  }, [isPaused])

  useEffect(() => {
    if (!isPaused) {
      setDisplayedEvents(latestEvents)
    }
  }, [latestEvents, isPaused])

  for (const event of displayedEvents) {
    if (!latestBySensor.has(event.sensor_id)) {
      latestBySensor.set(event.sensor_id, event)
    }
  }

  const sensorById = new Map(sensors.map((sensor) => [sensor.sensor_id, sensor]))
  const trailingEvents = displayedEvents
    .slice(0, 80)
    .map((event) => {
      const timestampMs = Date.parse(event.timestamp)
      const ageMs = Number.isNaN(timestampMs) ? Number.POSITIVE_INFINITY : nowMs - timestampMs
      const sensor = event.sensor ?? sensorById.get(event.sensor_id)
      return {
        event,
        ageMs,
        sensor,
      }
    })
    .filter(
      (
        entry,
      ): entry is {
        event: SeismicEvent
        ageMs: number
        sensor: SensorMeta
      } => Boolean(entry.sensor) && entry.ageMs >= 0 && entry.ageMs <= 40_000,
    )

  return (
    <section className="tactical-panel relative min-h-[16rem] overflow-hidden p-3 sm:min-h-[20rem] sm:p-4">
      <div className="relative z-10 flex items-center justify-between pb-3 text-xs uppercase tracking-[0.22em] text-zinc-400">
        <span>Global Sensor Map</span>
        <div className="flex items-center gap-2">
          <span>{sensors.length} units online</span>
          <button
            type="button"
            className="rounded-sm border border-cyan-500/70 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-500/20"
            onClick={() => {
              if (!isPaused) {
                setNowMs(Date.now())
              }
              setIsPaused((value) => !value)
            }}
            aria-pressed={isPaused}
          >
            {isPaused ? 'Resume Map' : 'Pause Map'}
          </button>
        </div>
      </div>

      <div className="relative z-10 h-[13rem] rounded-sm border border-zinc-700/80 bg-zinc-950/70 sm:h-[16.5rem]">
        <div className="map-radar-overlay" aria-hidden="true">
          <span className="map-radar-sweep" />
          <span className="map-radar-ring map-radar-ring--one" />
          <span className="map-radar-ring map-radar-ring--two" />
        </div>

        {sensors.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.2em] text-zinc-500">
            Waiting for sensor telemetry...
          </div>
        ) : (
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            minZoom={2}
            maxZoom={8}
            maxBounds={WORLD_BOUNDS}
            worldCopyJump
            className="sensor-world-map h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <SensorBounds sensors={sensors} />

            {trailingEvents.map(({ event, ageMs, sensor }) => {
              const fade = 1 - ageMs / 40_000
              const radius = 35_000 + fade * 220_000
              const color = CLASS_HEX[event.classification]

              return (
                <Circle
                  key={`${event.event_id}:${Math.floor(ageMs / 1000)}`}
                  center={[sensor.lat, sensor.long]}
                  radius={radius}
                  pathOptions={{
                    color,
                    opacity: 0.08 + fade * 0.45,
                    fillColor: color,
                    fillOpacity: 0.02 + fade * 0.12,
                    weight: event.classification === 'NUCLEAR_LIKE' ? 2 : 1,
                  }}
                  interactive={false}
                />
              )
            })}

            {sensors.map((sensor) => {
              const event = latestBySensor.get(sensor.sensor_id)
              const tone = event ? CLASS_COLOR[event.classification] : 'eq'
              const isHot = hotSensors.has(sensor.sensor_id)

              return (
                <Marker
                  key={sensor.sensor_id}
                  position={[sensor.lat, sensor.long]}
                  icon={buildSensorIcon(isHot, tone)}
                  eventHandlers={{
                    click: () => onSelectSensor?.(sensor.sensor_id),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="sensor-map-tooltip">
                    <div className="text-[10px] uppercase tracking-[0.14em]">
                      <div>{sensor.sensor_id}</div>
                      <div className="mt-1 text-zinc-300">
                        <ZoneNavLink zone={sensor.region} className="px-0 py-0 text-zinc-300 hover:text-cyan-200" />
                      </div>
                      <div className="mt-1 text-zinc-400">
                        {sensor.lat.toFixed(2)}, {sensor.long.toFixed(2)}
                      </div>
                    </div>
                  </Tooltip>
                </Marker>
              )
            })}
          </MapContainer>
        )}
      </div>
    </section>
  )
}
