import clsx from 'clsx'
import type { ConnectionState } from '../../types/seismic'

interface StatusDotProps {
  state: ConnectionState
}

const COLOR_MAP: Record<ConnectionState, string> = {
  connected: 'bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.8)]',
  connecting: 'bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)] animate-pulse',
  reconnecting: 'bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)] animate-pulse',
  disconnected: 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.9)]',
  error: 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.9)] animate-pulse',
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
    <div className="inline-flex items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-900/90 px-3 py-1 text-xs tracking-[0.24em] text-zinc-200">
      <span className={clsx('h-2.5 w-2.5 rounded-full', COLOR_MAP[state])} aria-hidden />
      <span>{LABEL_MAP[state]}</span>
    </div>
  )
}
