import type { DisconnectEvent, FaultType } from '../../types/seismic'

interface ReconnectingOverlayProps {
  attempts: number
  active: boolean
  onRetry: () => void
  faultType: FaultType
  disconnectHistory: DisconnectEvent[]
  lastError?: string
}

const faultLabel: Record<FaultType, string> = {
  network: 'Network link degradation',
  gateway: 'Gateway health degraded',
  replica: 'Replica failover in progress',
  configuration: 'Configuration issue detected',
  unknown: 'Unknown transport fault',
}

export const ReconnectingOverlay = ({
  attempts,
  active,
  onRetry,
  faultType,
  disconnectHistory,
  lastError,
}: ReconnectingOverlayProps) => {
  if (!active) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
      <div className="pointer-events-auto tactical-panel w-[min(92vw,32rem)] border-rose-500/40 text-center">
        <p className="text-xs uppercase tracking-[0.36em] text-rose-300">Signal Link Interrupted</p>
        <h2 className="mt-3 text-2xl font-semibold text-zinc-100">Reconnecting...</h2>
        <p className="mt-2 text-sm text-zinc-400">Attempt #{attempts}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-amber-300">{faultLabel[faultType]}</p>
        {lastError ? <p className="mt-2 text-[11px] text-rose-300">{lastError}</p> : null}

        <div className="mt-4 rounded-sm border border-zinc-700/80 bg-zinc-950/50 p-2 text-left text-[10px] uppercase tracking-[0.12em] text-zinc-400">
          <p className="mb-2 text-zinc-300">Recent disconnections</p>
          {disconnectHistory.length === 0 ? (
            <p>No completed recovery windows yet.</p>
          ) : (
            disconnectHistory.slice(0, 3).map((entry) => (
              <p key={`${entry.startedAt}-${entry.endedAt}`}>
                {entry.startedAt.replace('T', ' ').replace('Z', ' UTC')} | {(entry.durationMs / 1000).toFixed(1)}s | {entry.faultType}
              </p>
            ))
          )}
        </div>

        <button
          type="button"
          className="mt-6 rounded-sm border border-rose-400/70 bg-rose-600/15 px-4 py-2 text-xs uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-600/25"
          onClick={onRetry}
        >
          Retry Now
        </button>
      </div>
    </div>
  )
}
