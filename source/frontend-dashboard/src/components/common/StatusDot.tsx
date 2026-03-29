import clsx from 'clsx'
import type { ConnectionState } from '../../types/seismic'

interface StatusDotProps {
  state: ConnectionState
}

const COLOR_MAP: Record<ConnectionState, string> = {
  connected: 'status-connected',
  connecting: 'status-connecting u-neon-flicker',
  reconnecting: 'status-reconnecting u-neon-flicker',
  disconnected: 'status-disconnected',
  error: 'status-error u-neon-flicker',
}

const LABEL_MAP: Record<ConnectionState, string> = {
  connected: 'ONLINE',
  connecting: 'RECONNECTING',
  reconnecting: 'RECONNECTING',
  disconnected: 'OFFLINE',
  error: 'OFFLINE',
}

export const StatusDot = ({ state }: StatusDotProps) => {
  return (
    <div className="status-chip inline-flex items-center gap-2 px-3 py-1 text-xs tracking-[0.24em] text-zinc-200">
      <span className={clsx('status-indicator', COLOR_MAP[state])} aria-hidden />
      <span className={clsx('status-label', state === 'connected' && 'is-online')}>{LABEL_MAP[state]}</span>
    </div>
  )
}
