import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { divIcon, type LatLngTuple } from 'leaflet'
import { SensorNavLink } from './SensorNavLink'
import { ZoneNavLink } from './ZoneNavLink'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { classificationBadgeClass, classificationLabel } from '../../utils/classification'
import { formatFrequency, formatUtcTimestamp } from '../../utils/format'
import { useTimezone } from '../../contexts/TimezoneContext'
import type { SeismicEvent } from '../../types/seismic'
import { fetchEventCorroboration, type EventCorroboration } from '../../services/historyApi'

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
  const { timezone } = useTimezone()
  const [corroboration, setCorroboration] = useState<EventCorroboration | null>(null)
  const [corroborationLoading, setCorroborationLoading] = useState(false)

  useEffect(() => {
    if (!event) {
      setCorroboration(null)
      return
    }
    setCorroborationLoading(true)
    fetchEventCorroboration(event.event_id)
      .then(setCorroboration)
      .catch(() => setCorroboration(null))
      .finally(() => setCorroborationLoading(false))
  }, [event?.event_id])

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
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 px-3 py-4 backdrop-blur-[1px]">
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
              <span className="whitespace-nowrap text-zinc-100">{formatUtcTimestamp(event.startsAt ?? event.timestamp, timezone)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Avg. Frequency</span>
              <span className="text-zinc-100">{formatFrequency(event.frequency)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Confirmed</span>
              <span className={clsx(
                'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-[0.1em]',
                event.confirmed
                  ? 'border border-emerald-500/40 bg-emerald-900/30 text-emerald-300'
                  : 'border border-zinc-600/40 bg-zinc-800/30 text-zinc-400',
              )}>
                {event.confirmed ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Replicas reported</span>
              <span className="text-zinc-100">
                {corroborationLoading ? '—' : (corroboration?.reporter_count ?? event.reporter_count ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Event ID</span>
              <span className="max-w-[14rem] truncate text-zinc-100">{event.event_id}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Region</span>
              <span className="text-zinc-100">
                {event.sensor?.region ? (
                  <ZoneNavLink zone={event.sensor.region} className="px-0 py-0 text-zinc-100 hover:text-cyan-200" />
                ) : (
                  'UNSPECIFIED'
                )}
              </span>
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

        {/* Replica Corroboration Report */}
        <div className="mt-3 rounded-sm border border-zinc-700/80 bg-zinc-900/45 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">Replica Corroboration</p>
          {corroborationLoading ? (
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Loading...</p>
          ) : corroboration && corroboration.replica_ids.length > 0 ? (
            <>
              {/* Per-replica breakdown */}
              <div className="mb-2 grid grid-cols-[1fr_0.9fr_1.1fr_1.2fr] gap-x-2 border-b border-zinc-700/60 pb-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                <span>Replica</span>
                <span>Freq.</span>
                <span>Classification</span>
                <span>Detected at</span>
              </div>
              <div className="space-y-1">
                {corroboration.replica_ids.map((replicaId, i) => {
                  const rawCls = corroboration.classifications[i] ?? ''
                  const normalizedCls = rawCls === 'NUCLEAR_EVENT' ? 'NUCLEAR_LIKE' : rawCls
                  const clsBadge =
                    normalizedCls === 'NUCLEAR_LIKE'
                      ? 'text-rose-300 border-rose-600/50'
                      : normalizedCls === 'CONVENTIONAL_EXPLOSION'
                        ? 'text-amber-300 border-amber-500/50'
                        : 'text-cyan-300 border-cyan-500/50'
                  return (
                    <div
                      key={replicaId}
                      className="grid grid-cols-[1fr_0.9fr_1.1fr_1.2fr] items-center gap-x-2 text-[11px] uppercase tracking-[0.08em]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" />
                        <span className="truncate text-zinc-300">{replicaId}</span>
                      </div>
                      <span className="text-zinc-200">
                        {corroboration.frequencies[i] != null
                          ? formatFrequency(corroboration.frequencies[i])
                          : '—'}
                      </span>
                      <span className={clsx('max-w-fit truncate rounded-sm border px-1.5 py-0.5 text-[9px]', clsBadge)}>
                        {normalizedCls.replace('NUCLEAR_LIKE', 'NUCLEAR').replace('CONVENTIONAL_EXPLOSION', 'EXPLOS.').replace('EARTHQUAKE', 'EQ')}
                      </span>
                      <span className="text-zinc-500">
                        {corroboration.detected_ats[i]
                          ? formatUtcTimestamp(corroboration.detected_ats[i], timezone)
                          : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">No replica data available</p>
          )}
        </div>
      </div>
    </div>
  )
}
