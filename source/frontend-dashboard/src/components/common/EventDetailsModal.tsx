import clsx from 'clsx'
import { useMemo } from 'react'
import { divIcon, type LatLngTuple } from 'leaflet'
import { SensorNavLink } from './SensorNavLink'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { classificationBadgeClass, classificationLabel } from '../../utils/classification'
import { formatFrequency, formatUtcTimestamp } from '../../utils/format'
import type { SeismicEvent } from '../../types/seismic'

interface EventDetailsModalProps {
  event: SeismicEvent | null
  onClose: () => void
}

const miniMapIcon = divIcon({
  className: 'sensor-marker-wrapper',
  html: '<span class="sensor-marker eq"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

export const EventDetailsModal = ({ event, onClose }: EventDetailsModalProps) => {
  const location = useMemo(() => {
    if (!event?.sensor) {
      return null
    }

    return [event.sensor.lat, event.sensor.long] as LatLngTuple
  }, [event])

  if (!event) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 px-3 py-4 backdrop-blur-[1px]">
      <div className="tactical-panel w-[min(96vw,44rem)] border-zinc-600/80 bg-zinc-950/95 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Event Detail</p>
            <h3 className="mt-1 text-sm uppercase tracking-[0.18em] text-zinc-100">
              Sensor <SensorNavLink sensorId={event.sensor_id} className="text-zinc-100 hover:text-cyan-200" />
            </h3>
          </div>
          <button
            type="button"
            className="rounded-sm border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs uppercase tracking-[0.14em] text-zinc-300 transition hover:border-zinc-400 hover:text-zinc-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.25fr_1fr]">
          <div className="space-y-2 rounded-sm border border-zinc-700/80 bg-zinc-900/45 p-3 text-xs uppercase tracking-[0.12em] text-zinc-300">
            <div className="flex items-center justify-between gap-2">
              <span>Classification</span>
              <span
                className={clsx(
                  'inline-flex max-w-fit rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.1em]',
                  classificationBadgeClass[event.classification],
                )}
              >
                {classificationLabel[event.classification]}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Timestamp (UTC)</span>
              <span className="text-zinc-100">{formatUtcTimestamp(event.startsAt ?? event.timestamp)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Frequency</span>
              <span className="text-zinc-100">{formatFrequency(event.frequency)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Amplitude</span>
              <span className="text-zinc-100">{event.amplitude?.toFixed(2) ?? 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Event ID</span>
              <span className="max-w-[14rem] truncate text-zinc-100">{event.event_id}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Region</span>
              <span className="text-zinc-100">{event.sensor?.region ?? 'UNSPECIFIED'}</span>
            </div>
          </div>

          <div className="rounded-sm border border-zinc-700/80 bg-zinc-900/45 p-2">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">Detection Map</p>
            {location ? (
              <div className="h-48 overflow-hidden rounded-sm border border-zinc-700/70">
                <MapContainer
                  center={location}
                  zoom={5}
                  scrollWheelZoom={false}
                  dragging={false}
                  doubleClickZoom={false}
                  zoomControl={false}
                  attributionControl={false}
                  className="sensor-world-map h-full w-full"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={location} icon={miniMapIcon} />
                </MapContainer>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-sm border border-zinc-700/70 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                Location unavailable for this event
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
