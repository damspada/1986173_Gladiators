import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DisconnectEvent, InfrastructureStatus, ReplicaDisconnectionEvent } from '../types/seismic'
import { fetchReplicaDisconnections } from '../services/historyApi'
import { formatUtcTimestamp } from '../utils/format'
import { useTimezone } from '../contexts/TimezoneContext'

const resolveInfrastructureWsUrl = (historyApiUrl?: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

  try {
    if (historyApiUrl?.trim()) {
      const url = new URL(historyApiUrl)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      url.pathname = '/api/infrastructure/ws'
      url.search = ''
      return url.toString()
    }
  } catch {
    // fall back to same-origin path when URL parsing fails
  }

  return `${protocol}//${window.location.host}/api/infrastructure/ws`
}

interface InfrastructurePageProps {
  historyApiUrl?: string
  disconnectHistory?: DisconnectEvent[]
}

export const InfrastructurePage = ({ historyApiUrl, disconnectHistory = [] }: InfrastructurePageProps) => {
  const { timezone } = useTimezone()
  const [infrastructure, setInfrastructure] = useState<InfrastructureStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  // Disconnections table state
  const [discEvents, setDiscEvents] = useState<ReplicaDisconnectionEvent[]>([])
  const [discTotal, setDiscTotal] = useState(0)
  const [discPage, setDiscPage] = useState(0)
  const [discSize] = useState(10)
  const [discReplicaFilter, setDiscReplicaFilter] = useState('')
  const [discLoading, setDiscLoading] = useState(false)
  const [discError, setDiscError] = useState<string | null>(null)

  const loadDisconnections = useCallback(async (page: number, replicaId: string) => {
    setDiscLoading(true)
    setDiscError(null)
    try {
      const result = await fetchReplicaDisconnections(page, discSize, replicaId || undefined)
      setDiscEvents(result.events)
      setDiscTotal(result.total)
    } catch (err: unknown) {
      setDiscError(err instanceof Error ? err.message : 'Failed to load disconnections.')
    } finally {
      setDiscLoading(false)
    }
  }, [discSize])

  useEffect(() => {
    void loadDisconnections(discPage, discReplicaFilter)
  }, [loadDisconnections, discPage, discReplicaFilter])

  useEffect(() => {
    const trimmed = historyApiUrl?.trim()
    if (!trimmed) {
      setError('Infrastructure endpoint unavailable: set VITE_HISTORY_API_URL.')
      setLoading(false)
      return
    }

    let active = true
    let pollTimer: number | null = null
    let socket: WebSocket | null = null

    const loadInfrastructure = async () => {
      try {
        const url = new URL(trimmed)
        url.pathname = '/api/infrastructure/status'
        url.search = ''

        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as InfrastructureStatus

        if (active) {
          setInfrastructure(data)
          setLastUpdate(new Date())
          setError(null)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load infrastructure status.')
          if (!infrastructure) {
            setInfrastructure(null)
          }
          setLoading(false)
        }
      }
    }

    void loadInfrastructure()

    const wsUrl = resolveInfrastructureWsUrl(trimmed)
    try {
      socket = new WebSocket(wsUrl)

      socket.onopen = () => {
        if (!active) {
          return
        }
        setWsConnected(true)
      }

      socket.onmessage = () => {
        if (!active) {
          return
        }
        void loadInfrastructure()
      }

      socket.onclose = () => {
        if (!active) {
          return
        }
        setWsConnected(false)
      }

      socket.onerror = () => {
        if (!active) {
          return
        }
        setWsConnected(false)
      }
    } catch {
      setWsConnected(false)
    }

    pollTimer = window.setInterval(() => {
      void loadInfrastructure()
    }, 5000)

    return () => {
      active = false
      if (pollTimer) {
        window.clearInterval(pollTimer)
      }

      if (socket) {
        socket.close()
      }
    }
  }, [historyApiUrl])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/live" className="text-zinc-400 hover:text-cyan-200">
          ← Back to Live
        </Link>
        {lastUpdate && (
          <div className="text-right">
            <p className="text-[9px] text-zinc-500">
              Last update: {lastUpdate.toLocaleTimeString()}
            </p>
            <p className={`text-[9px] uppercase tracking-[0.08em] ${wsConnected ? 'text-emerald-300' : 'text-zinc-500'}`}>
              {wsConnected ? 'live websocket' : 'polling fallback'}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-sm border border-rose-400/70 bg-rose-900/25 px-3 py-2 text-[11px] uppercase tracking-[0.1em] text-rose-300">
          {error}
        </div>
      )}

      {loading && !infrastructure ? (
        <div className="rounded-sm border border-zinc-700/80 bg-zinc-900/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Loading infrastructure status...</p>
        </div>
      ) : infrastructure ? (
        <div className="space-y-4">
          {/* Gateway Status */}
          <section className="tactical-panel p-4">
            <h2 className="mb-4 text-[13px] uppercase tracking-[0.2em] text-cyan-200">Gateway Status</h2>
            <div
              className={`rounded-sm border px-4 py-3 ${
                infrastructure.gateway === 'healthy'
                  ? 'border-emerald-500/70 bg-emerald-900/20 text-emerald-200'
                  : 'border-rose-500/70 bg-rose-900/20 text-rose-200'
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.1em]">
                {infrastructure.gateway.charAt(0).toUpperCase() + infrastructure.gateway.slice(1)}
              </p>
            </div>
          </section>

          {/* Replicas Grid */}
          <section className="tactical-panel p-4">
            <h2 className="mb-4 text-[13px] uppercase tracking-[0.2em] text-cyan-200">Processing Replicas</h2>
            {infrastructure.replicas.length === 0 ? (
              <p className="text-[11px] text-zinc-400">No replicas found</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {infrastructure.replicas.map((replica) => (
                  <div
                    key={replica.id}
                    className={`rounded-sm border px-4 py-4 transition ${
                      replica.status === 'healthy'
                        ? 'border-emerald-500/60 bg-emerald-900/15 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                        : 'border-rose-500/60 bg-rose-900/15 shadow-[0_0_12px_rgba(244,63,94,0.1)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-100">
                        {replica.id}
                      </p>
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          replica.status === 'healthy' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-400'
                        }`}
                      />
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-400">
                        Status: <span className={replica.status === 'healthy' ? 'text-emerald-300' : 'text-rose-300'}>
                          {replica.status.charAt(0).toUpperCase() + replica.status.slice(1)}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Disconnect Timeline */}
          {disconnectHistory.length > 0 && (
            <section className="tactical-panel p-4">
              <h2 className="mb-4 text-[13px] uppercase tracking-[0.2em] text-cyan-200">Disconnect Timeline</h2>
              <div className="space-y-2">
                {disconnectHistory.map((event, index) => {
                  const faultTypeColor: Record<string, string> = {
                    network: 'border-blue-500/70 bg-blue-900/20 text-blue-200',
                    gateway: 'border-amber-500/70 bg-amber-900/20 text-amber-200',
                    replica: 'border-rose-500/70 bg-rose-900/20 text-rose-200',
                    configuration: 'border-purple-500/70 bg-purple-900/20 text-purple-200',
                    unknown: 'border-zinc-500/70 bg-zinc-900/20 text-zinc-200',
                  }

                  return (
                    <div
                      key={`${event.startedAt}-${index}`}
                      className={`rounded-sm border px-3 py-2 text-[10px] uppercase tracking-[0.08em] ${faultTypeColor[event.faultType] || faultTypeColor.unknown}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{event.startedAt.replace('T', ' ').slice(0, -1)}</span>
                        <span>Duration: {(event.durationMs / 1000).toFixed(1)}s</span>
                        <span className="ml-2 font-medium">{event.faultType}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      ) : null}

      {/* Replica Disconnection Events Table */}
      <section className="tactical-panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[13px] uppercase tracking-[0.2em] text-cyan-200">Replica Disconnection Events</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by replica ID"
              value={discReplicaFilter}
              onChange={(e) => {
                setDiscPage(0)
                setDiscReplicaFilter(e.target.value)
              }}
              className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-cyan-500/60 w-48"
            />
            <button
              type="button"
              onClick={() => void loadDisconnections(discPage, discReplicaFilter)}
              disabled={discLoading}
              className="rounded-sm border border-cyan-500/70 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-500"
            >
              {discLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {discError && (
          <p className="mb-3 text-[11px] text-rose-400">{discError}</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-zinc-700/60 text-left text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                <th className="pb-2 pr-4 font-normal">Replica</th>
                <th className="pb-2 pr-4 font-normal">Disconnected At (UTC)</th>
                <th className="pb-2 pr-4 font-normal">Session Duration</th>
              </tr>
            </thead>
            <tbody>
              {discEvents.length === 0 && !discLoading ? (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-zinc-500 uppercase tracking-[0.12em]">
                    No disconnection events recorded.
                  </td>
                </tr>
              ) : (
                discEvents.map((ev) => {
                  const durationLabel = ev.duration_seconds < 0
                    ? 'unknown'
                    : ev.duration_seconds < 60
                      ? `${ev.duration_seconds}s`
                      : ev.duration_seconds < 3600
                        ? `${Math.floor(ev.duration_seconds / 60)}m ${ev.duration_seconds % 60}s`
                        : `${Math.floor(ev.duration_seconds / 3600)}h ${Math.floor((ev.duration_seconds % 3600) / 60)}m`

                  return (
                    <tr
                      key={ev.id}
                      className="border-b border-zinc-800/60 text-zinc-300 transition hover:bg-zinc-800/30"
                    >
                      <td className="py-2 pr-4 font-mono text-cyan-300/80">{ev.replica_id}</td>
                      <td className="py-2 pr-4 font-mono text-zinc-400">{ev.timestamp ? formatUtcTimestamp(ev.timestamp, timezone) : '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={ev.duration_seconds < 0 ? 'text-zinc-500' : ev.duration_seconds > 300 ? 'text-rose-300' : 'text-amber-300'}>
                          {durationLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {discTotal > discSize && (
          <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-zinc-400">
            <span>{discTotal} total event{discTotal !== 1 ? 's' : ''} · page {discPage + 1} of {Math.ceil(discTotal / discSize)}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDiscPage((p) => Math.max(0, p - 1))}
                disabled={discPage === 0 || discLoading}
                className="rounded-sm border border-zinc-700 px-2 py-0.5 hover:border-cyan-500/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => setDiscPage((p) => p + 1)}
                disabled={(discPage + 1) * discSize >= discTotal || discLoading}
                className="rounded-sm border border-zinc-700 px-2 py-0.5 hover:border-cyan-500/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  )
}
