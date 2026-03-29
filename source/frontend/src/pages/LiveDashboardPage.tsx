import clsx from 'clsx'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { groupEventsByIncident } from '../utils/incidents'
import { classificationLabel } from '../utils/classification'
import { ZoneNavLink } from '../components/common/ZoneNavLink'
import type { InfrastructureStatus, SeismicEvent, SensorMeta } from '../types/seismic'
import { SensorGridMap } from '../components/live/SensorGridMap'
import { LiveEventFeed } from '../components/live/LiveEventFeed'

interface LiveDashboardPageProps {
  sensors: SensorMeta[]
  events: SeismicEvent[]
  infrastructure: InfrastructureStatus | null
  diagnostics: string[]
  onSelectEvent: (event: SeismicEvent) => void
  onOpenSensor: (sensorId: string) => void
}

export const LiveDashboardPage = ({
  sensors,
  events,
  infrastructure,
  diagnostics,
  onSelectEvent,
  onOpenSensor,
}: LiveDashboardPageProps) => {
  const regionIncidents = useMemo(() => groupEventsByIncident(events, 4 * 60 * 1000), [events])
  const healthyReplicas = infrastructure?.replicas.filter((item) => item.status === 'healthy').length ?? 0
  const totalReplicas = infrastructure?.replicas.length ?? 0
  const latestRegionIncident = regionIncidents[0] ?? null

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SensorGridMap sensors={sensors} latestEvents={events} onSelectSensor={onOpenSensor} />
          <LiveEventFeed events={events} onSelectEvent={onSelectEvent} />
        </div>

        <aside className="space-y-4">
          <section className="tactical-panel p-3">
            <Link
              to="/infrastructure"
              className="text-[11px] uppercase tracking-[0.2em] text-zinc-300 hover:text-cyan-200 transition-colors"
            >
              Infrastructure
            </Link>
            <div className="mt-2 space-y-1 text-[11px] uppercase tracking-[0.1em] text-zinc-300">
              <p>Replicas: <span className="text-zinc-100">{healthyReplicas}/{totalReplicas}</span></p>
              <p>Last failover:</p>
              <p className="text-zinc-400">{infrastructure?.lastFailoverAt ? infrastructure.lastFailoverAt.replace('T', ' ').replace('Z', ' UTC') : 'not recorded'}</p>
            </div>
            <div className="mt-3 space-y-1">
              {diagnostics.map((message) => (
                <p
                  key={message}
                  className={clsx(
                    'rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.1em]',
                    message.includes('OK')
                      ? 'border-emerald-500/70 bg-emerald-900/20 text-emerald-200'
                      : 'border-rose-400/70 bg-rose-900/25 text-rose-300',
                  )}
                >
                  {message}
                </p>
              ))}
            </div>
          </section>

          <section className="tactical-panel p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              <span>Region Incidents</span>
              <span>{regionIncidents.length}</span>
            </div>
            {latestRegionIncident ? (
              <div className="mb-2 rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-2 py-2 text-xs">
                <p className="uppercase tracking-[0.08em] text-zinc-200">
                  Latest:{' '}
                  <ZoneNavLink zone={latestRegionIncident.region} className="px-0 py-0 text-zinc-200 hover:text-cyan-200" />
                </p>
                <p className="mt-1 text-zinc-400">{latestRegionIncident.count} events | {classificationLabel[latestRegionIncident.severity]}</p>
              </div>
            ) : null}
            <div className="max-h-[16rem] space-y-2 overflow-y-auto pr-1 text-xs">
              {regionIncidents.slice(0, 8).map((region) => (
                <div key={region.id} className="rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-2 py-2">
                  <p className="uppercase tracking-[0.08em] text-zinc-200">
                    <ZoneNavLink zone={region.region} className="px-0 py-0 text-zinc-200 hover:text-cyan-200" />
                  </p>
                  <p className="mt-1 text-zinc-400">{region.count} events | {classificationLabel[region.severity]}</p>
                </div>
              ))}
              {regionIncidents.length === 0 ? <p className="text-zinc-500">No aggregated incidents.</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
