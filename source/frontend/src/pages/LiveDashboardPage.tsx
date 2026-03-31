import clsx from 'clsx'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { groupEventsByIncident } from '../utils/incidents'
import { classificationLabel } from '../utils/classification'
import { ZoneNavLink } from '../components/common/ZoneNavLink'
import type { InfrastructureStatus, MissionMetrics, SeismicEvent, SensorMeta } from '../types/seismic'
import { SensorGridMap } from '../components/live/SensorGridMap'
import { LiveEventFeed } from '../components/live/LiveEventFeed'

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const ss = String(totalSeconds % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

interface LiveDashboardPageProps {
  sensors: SensorMeta[]
  events: SeismicEvent[]
  infrastructure: InfrastructureStatus | null
  diagnostics: string[]
  missionMetrics: MissionMetrics
  onSelectEvent: (event: SeismicEvent) => void
  onOpenSensor: (sensorId: string) => void
}

export const LiveDashboardPage = ({
  sensors,
  events,
  infrastructure,
  diagnostics,
  missionMetrics,
  onSelectEvent,
  onOpenSensor,
}: LiveDashboardPageProps) => {
  const regionIncidents = useMemo(() => groupEventsByIncident(events, 4 * 60 * 1000), [events])
  const healthyReplicas = infrastructure?.replicas.filter((item) => item.status === 'healthy').length ?? 0
  const totalReplicas = infrastructure?.replicas.length ?? 0
  const downReplicas = infrastructure?.replicas.filter((item) => item.status === 'down') ?? []
  const latestRegionIncident = regionIncidents[0] ?? null
  const infrastructureHealthLabel = totalReplicas > 0 && healthyReplicas === totalReplicas
    ? 'Nominal'
    : totalReplicas > 0 && healthyReplicas > 0
      ? 'Degraded'
      : 'Unavailable'

  const eventTypeBreakdown = useMemo(() => {
    const breakdown = {
      EARTHQUAKE: 0,
      CONVENTIONAL_EXPLOSION: 0,
      NUCLEAR_LIKE: 0,
    }

    for (const event of events) {
      breakdown[event.classification] += 1
    }

    return breakdown
  }, [events])

  return (
    <section className="space-y-4">
      <section className="tactical-panel p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          <span>Live Operations Overview</span>
          <span>{events.length} buffered events</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Session uptime</p>
            <p className="mt-1 text-sm uppercase tracking-[0.1em] text-cyan-200">{formatDuration(missionMetrics.uptimeMs)}</p>
          </div>
          <div className="rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Total reconnects</p>
            <p className="mt-1 text-sm uppercase tracking-[0.1em] text-amber-200">{missionMetrics.reconnectCount}</p>
          </div>
          <div className="rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Max disconnect</p>
            <p className="mt-1 text-sm uppercase tracking-[0.1em] text-rose-200">{formatDuration(missionMetrics.maxDisconnectMs)}</p>
          </div>
          <div className="rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Estimated lost events</p>
            <p className="mt-1 text-sm uppercase tracking-[0.1em] text-zinc-100">{missionMetrics.estimatedLostEvents}</p>
          </div>
        </div>
      </section>

      {infrastructureHealthLabel !== 'Nominal' && (
        <section className="rounded-sm border border-rose-500/70 bg-rose-900/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-rose-400 animate-pulse"></div>
            <p className="text-sm font-medium text-rose-200">Infrastructure Alert</p>
          </div>
          <p className="mt-1 text-xs text-rose-300">
            {infrastructureHealthLabel === 'Degraded'
              ? `${downReplicas.length} replica(s) are down: ${downReplicas.map((r) => r.id).join(', ')}`
              : 'All replicas are unavailable.'
            }
          </p>
        </section>
      )}


      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SensorGridMap sensors={sensors} latestEvents={events} onSelectSensor={onOpenSensor} />
          <LiveEventFeed events={events} onSelectEvent={onSelectEvent} />
        </div>

        <aside className="space-y-4">
          <section className="tactical-panel p-3">
            <Link
              to="/infrastructure"
              className="group inline-flex items-center gap-2 rounded-sm border border-zinc-600/90 bg-zinc-900/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-400/80 hover:bg-cyan-500/10 hover:text-cyan-200"
              aria-label="Open infrastructure page"
            >
              <span>Infrastructure</span>
              <span className="text-zinc-500 transition group-hover:text-cyan-300">Open -&gt;</span>
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
            <div className="mt-3">
              <button
                onClick={() => {
                  const memUsage = (globalThis as any).process?.memoryUsage?.() || {};
                  const cpuUsage = (globalThis as any).process?.cpuUsage?.() || {};
                  const metrics = {
                    timestamp: new Date().toISOString(),
                    sessionUptimeMs: missionMetrics.uptimeMs,
                    totalReconnects: missionMetrics.reconnectCount,
                    maxDisconnectMs: missionMetrics.maxDisconnectMs,
                    estimatedLostEvents: missionMetrics.estimatedLostEvents,
                    infrastructureHealth: infrastructureHealthLabel,
                    gatewayStatus: infrastructure?.gateway ?? 'unknown',
                    totalReplicas,
                    healthyReplicas,
                    activeReplica: infrastructure?.activeReplica ?? 'n/a',
                    lastFailoverAt: infrastructure?.lastFailoverAt ?? 'not recorded',
                    replicas: infrastructure?.replicas.map(r => ({ id: r.id, status: r.status })) ?? [],
                    systemMetrics: {
                      memoryUsageMB: {
                        rss: Math.round(memUsage.rss / 1024 / 1024),
                        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                        external: Math.round(memUsage.external / 1024 / 1024)
                      },
                      cpuUsage: {
                        user: cpuUsage.user,
                        system: cpuUsage.system
                      }
                    }
                  };
                  const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `infrastructure-metrics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="w-full rounded-sm border border-zinc-600 bg-zinc-800 px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-zinc-200 hover:bg-zinc-700"
              >
                Export Metrics
              </button>
            </div>
          </section>

          <section className="tactical-panel p-3">
            <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-zinc-400">Event Type Breakdown</div>
            <div className="mb-4 rounded-sm border border-zinc-600/50 bg-zinc-500/10 p-3 text-center">
              <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-300">Total Events</p>
              <p className="mt-2 text-2xl font-bold text-zinc-100">{events.length}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-sm border border-cyan-600/50 bg-cyan-500/10 p-2 text-center">
                <p className="text-[9px] uppercase tracking-[0.1em] text-cyan-300">Earthquake</p>
                <p className="mt-2 text-lg font-bold text-cyan-200">{eventTypeBreakdown.EARTHQUAKE}</p>
              </div>
              <div className="rounded-sm border border-amber-600/50 bg-amber-500/10 p-2 text-center">
                <p className="text-[9px] uppercase tracking-[0.1em] text-amber-300">Conventional</p>
                <p className="mt-2 text-lg font-bold text-amber-200">{eventTypeBreakdown.CONVENTIONAL_EXPLOSION}</p>
              </div>
              <div className="rounded-sm border border-rose-600/50 bg-rose-500/10 p-2 text-center">
                <p className="text-[9px] uppercase tracking-[0.1em] text-rose-300">Nuclear-like</p>
                <p className="mt-2 text-lg font-bold text-rose-200">{eventTypeBreakdown.NUCLEAR_LIKE}</p>
              </div>
            </div>
          </section>

          <section className="region-incidents-panel tactical-panel p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              <span>Region Incidents</span>
              <span>{regionIncidents.length}</span>
            </div>
            {latestRegionIncident ? (
              <div className="region-incident-card region-incident-card--latest mb-2 rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-2 py-2 text-xs">
                <p className="uppercase tracking-[0.08em] text-zinc-200">
                  Latest:{' '}
                  <ZoneNavLink zone={latestRegionIncident.region} className="px-0 py-0 text-zinc-200 hover:text-cyan-200" />
                </p>
                <p className="region-incident-meta mt-1 text-zinc-400">{latestRegionIncident.count} events | {classificationLabel[latestRegionIncident.severity]}</p>
              </div>
            ) : null}
            <div className="max-h-[16rem] space-y-2 overflow-y-auto pr-1 text-xs">
              {regionIncidents.slice(0, 8).map((region) => (
                <div key={region.id} className="region-incident-card rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-2 py-2">
                  <p className="uppercase tracking-[0.08em] text-zinc-200">
                    <ZoneNavLink zone={region.region} className="px-0 py-0 text-zinc-200 hover:text-cyan-200" />
                  </p>
                  <p className="region-incident-meta mt-1 text-zinc-400">{region.count} events | {classificationLabel[region.severity]}</p>
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
