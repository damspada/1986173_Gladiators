import { divIcon, latLngBounds, type LatLngTuple } from 'leaflet'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { SeismicEvent, SensorMeta } from '../../types/seismic'

interface SensorGridMapProps {
  sensors: SensorMeta[]
  latestEvents: SeismicEvent[]
  onSelectEvent?: (event: SeismicEvent) => void
}

const DEFAULT_CENTER: LatLngTuple = [20, 0]
const DEFAULT_ZOOM = 2
const WORLD_BOUNDS: [LatLngTuple, LatLngTuple] = [[-85, -180], [85, 180]]

const CLASS_COLOR: Record<SeismicEvent['classification'], string> = {
  EARTHQUAKE: 'eq',
  CONVENTIONAL_EXPLOSION: 'exp',
  NUCLEAR_LIKE: 'nuc',
}

const SensorBounds = ({ sensors }: { sensors: SensorMeta[] }) => {
  const map = useMap()

  if (sensors.length > 0) {
    const bounds = latLngBounds(sensors.map((sensor) => [sensor.lat, sensor.long] as LatLngTuple))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 })
  }

  return null
}

const buildSensorIcon = (isHot: boolean, tone: string) => {
  return divIcon({
    className: 'sensor-marker-wrapper',
    html: `<span class="sensor-marker ${tone} ${isHot ? 'is-hot' : ''}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export const SensorGridMap = ({ sensors, latestEvents, onSelectEvent }: SensorGridMapProps) => {
  const hotSensors = new Set(latestEvents.slice(0, 20).map((event) => event.sensor_id))
  const latestBySensor = new Map<string, SeismicEvent>()

  for (const event of latestEvents) {
    if (!latestBySensor.has(event.sensor_id)) {
      latestBySensor.set(event.sensor_id, event)
    }
  }

  return (
    <section className="tactical-panel relative min-h-[20rem] overflow-hidden p-4">
      <div className="relative z-10 flex items-center justify-between pb-3 text-xs uppercase tracking-[0.22em] text-zinc-400">
        <span>Global Sensor Map</span>
        <span>{sensors.length} units online</span>
      </div>

      <div className="relative z-10 h-[16.5rem] rounded-sm border border-zinc-700/80 bg-zinc-950/70">
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

            {sensors.map((sensor) => {
              const event = latestBySensor.get(sensor.sensor_id)
              const tone = event ? CLASS_COLOR[event.classification] : 'eq'
              const isHot = hotSensors.has(sensor.sensor_id)

              return (
                <Marker
                  key={sensor.sensor_id}
                  position={[sensor.lat, sensor.long]}
                  icon={buildSensorIcon(isHot, tone)}
                  eventHandlers={
                    event
                      ? {
                          click: () => onSelectEvent?.(event),
                        }
                      : undefined
                  }
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="sensor-map-tooltip">
                    <div className="text-[10px] uppercase tracking-[0.14em]">
                      <div>{sensor.sensor_id}</div>
                      <div className="mt-1 text-zinc-300">{sensor.region}</div>
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
