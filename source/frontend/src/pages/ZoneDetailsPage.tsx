import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SensorNavLink } from '../components/common/SensorNavLink'
import { classificationBadgeClass, classificationLabel } from '../utils/classification'
import { formatFrequency, formatUtcTimestamp } from '../utils/format'
import { fetchHistoryEvents } from '../services/historyApi'
import type { SeismicEvent, SensorMeta } from '../types/seismic'

interface ZoneDetailsPageProps {
  sensors: SensorMeta[]
  liveEvents: SeismicEvent[]
  onSelectEvent: (event: SeismicEvent) => void
}

const buildEventKey = (event: SeismicEvent): string => {
  if (event.event_id) {
    return event.event_id
  }

  return `${event.sensor_id}:${event.timestamp}:${event.frequency.toFixed(2)}`
}

export const ZoneDetailsPage = ({ sensors, liveEvents, onSelectEvent }: ZoneDetailsPageProps) => {
  const { zoneId: rawZoneId } = useParams()
  const zone = useMemo(() => decodeURIComponent(rawZoneId ?? '').trim(), [rawZoneId])
  const [historyEvents, setHistoryEvents] = useState<SeismicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!zone) {
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
          sensorId: '',
          region: zone,
        }, {
          limit: 300,
          offset: 0,
        })

        if (!active) {
          return
        }

        setHistoryEvents(result.events.filter((event) => (event.sensor?.region ?? '').toLowerCase() === zone.toLowerCase()))
      } catch (err: unknown) {
        if (!active) {
          return
        }

        setHistoryEvents([])
        setError(err instanceof Error ? err.message : 'Unable to load zone history.')
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
  }, [zone])

  const liveZoneEvents = useMemo(
    () => liveEvents.filter((event) => (event.sensor?.region ?? '').toLowerCase() === zone.toLowerCase()),
    [liveEvents, zone],
  )

  const allEvents = useMemo(() => {
    const merged = new Map<string, SeismicEvent>()

    for (const event of [...liveZoneEvents, ...historyEvents]) {
      const key = buildEventKey(event)
      if (!merged.has(key)) {
        merged.set(key, event)
      }
    }

    return [...merged.values()].sort((a, b) => Date.parse(b.startsAt ?? b.timestamp) - Date.parse(a.startsAt ?? a.timestamp))
  }, [historyEvents, liveZoneEvents])

  const zoneSensors = useMemo(() => {
    const fromCatalog = sensors.filter((sensor) => sensor.region.toLowerCase() === zone.toLowerCase())
    const byId = new Map(fromCatalog.map((sensor) => [sensor.sensor_id, sensor]))

    for (const event of allEvents) {
      if (event.sensor && !byId.has(event.sensor.sensor_id) && event.sensor.region.toLowerCase() === zone.toLowerCase()) {
        byId.set(event.sensor.sensor_id, event.sensor)
      }
    }

    return [...byId.values()].sort((a, b) => a.sensor_id.localeCompare(b.sensor_id))
  }, [allEvents, sensors, zone])

  const latestEvent = allEvents[0] ?? null

  if (!zone) {
    return (
      <section className="tactical-panel p-4">
        <p className="text-sm uppercase tracking-[0.16em] text-rose-300">Invalid zone identifier.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <section className="tactical-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Zone Dossier</p>
            <h2 className="mt-1 text-xl uppercase tracking-[0.18em] text-zinc-100">{zone}</h2>
          </div>
          <Link
            to="/live"
            className="rounded-sm border border-zinc-600 bg-zinc-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300 transition hover:border-cyan-400/70 hover:text-cyan-200"
          >
            Back To Live
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="tactical-panel p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Sensors in zone</p>
          <p className="mt-1 text-lg uppercase tracking-[0.1em] text-cyan-200">{zoneSensors.length}</p>
        </div>
        <div className="tactical-panel p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Events in buffer/history</p>
          <p className="mt-1 text-lg uppercase tracking-[0.1em] text-amber-200">{allEvents.length}</p>
        </div>
        <div className="tactical-panel p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Latest event</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-zinc-100">
            {latestEvent ? formatUtcTimestamp(latestEvent.startsAt ?? latestEvent.timestamp) : 'Not available'}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="tactical-panel p-3">
          <h3 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-300">Zone Sensors</h3>
          <div className="space-y-1 text-xs uppercase tracking-[0.12em]">
            {zoneSensors.length === 0 ? (
              <p className="text-zinc-500">No sensors mapped.</p>
            ) : (
              zoneSensors.map((sensor) => (
                <p key={sensor.sensor_id} className="rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-2 py-1 text-zinc-200">
                  <SensorNavLink sensorId={sensor.sensor_id} className="px-0 py-0" />
                </p>
              ))
            )}
          </div>
        </aside>

        <section className="tactical-panel p-3">
          <h3 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-300">Zone Event Log</h3>
          {error ? (
            <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-rose-300">{error}</p>
          ) : null}
          <div className="overflow-x-auto rounded-sm border border-zinc-700/90">
            <div className="min-w-[44rem]">
              <div className="grid grid-cols-[1fr_1.5fr_0.8fr_1fr] bg-zinc-900 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                <span>Sensor</span>
                <span>Timestamp (UTC)</span>
                <span>Frequency</span>
                <span>Classification</span>
              </div>
              <div className="max-h-[20rem] overflow-y-auto bg-zinc-950/70">
                {loading ? (
                  <p className="px-3 py-8 text-center text-xs uppercase tracking-[0.14em] text-zinc-500">Loading zone events...</p>
                ) : allEvents.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs uppercase tracking-[0.14em] text-zinc-500">No events available for this zone.</p>
                ) : (
                  allEvents.map((event) => (
                    <button
                      key={event.event_id}
                      type="button"
                      className="grid w-full grid-cols-[1fr_1.5fr_0.8fr_1fr] items-center border-b border-zinc-800/70 px-3 py-2 text-left text-xs text-zinc-200 transition hover:bg-zinc-900/40"
                      onClick={() => onSelectEvent(event)}
                    >
                      <span>
                        <SensorNavLink sensorId={event.sensor_id} className="px-0 py-0 text-zinc-100 hover:text-cyan-200" />
                      </span>
                      <span className="text-zinc-400">{formatUtcTimestamp(event.startsAt ?? event.timestamp)}</span>
                      <span>{formatFrequency(event.frequency)}</span>
                      <span className={clsx('inline-flex max-w-fit rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.08em]', classificationBadgeClass[event.classification])}>
                        {classificationLabel[event.classification]}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </section>
    </section>
  )
}