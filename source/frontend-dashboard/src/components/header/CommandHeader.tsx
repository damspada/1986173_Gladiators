import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { StatusDot } from '../common/StatusDot'
import { useUtcClock } from '../../hooks/useUtcClock'
import type { ConnectionState } from '../../types/seismic'

interface CommandHeaderProps {
  connectionState: ConnectionState
  onOpenAbout: () => void
}

export const CommandHeader = ({
  connectionState,
  onOpenAbout,
}: CommandHeaderProps) => {
  const utcClock = useUtcClock()

  return (
    <header className="tactical-panel border-zinc-700/80 px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/90 sm:text-[11px] sm:tracking-[0.42em]">Strategic Theater // Year 2038</p>
          <h1 className="mt-1 text-lg font-semibold tracking-[0.12em] text-zinc-100 sm:text-xl sm:tracking-[0.18em] md:text-2xl">GLOBAL SEISMIC MONITOR</h1>
        </div>
        <div className="flex flex-col items-start gap-2 text-xs uppercase tracking-[0.22em] text-zinc-300 md:items-end">
          <nav className="inline-flex rounded-sm border border-zinc-700/90 bg-zinc-900/80 p-1 text-[10px] tracking-[0.16em]">
            {[
              { to: '/live', label: 'Live' },
              { to: '/history', label: 'History' },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'rounded-sm border border-transparent px-3 py-1 text-zinc-300 transition',
                    'hover:border-cyan-500/70 hover:text-zinc-100',
                    isActive && 'border-cyan-400/80 bg-cyan-500/10 text-cyan-200',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="rounded-sm border border-zinc-700 bg-zinc-900/70 px-3 py-1">UTC {utcClock}</span>
            <button
              type="button"
              className="rounded-sm border border-zinc-700 bg-zinc-900/70 px-3 py-1 text-[10px] tracking-[0.14em] text-zinc-300 transition hover:border-cyan-400/70 hover:text-cyan-200"
              onClick={onOpenAbout}
            >
              About
            </button>
          </div>
          <StatusDot state={connectionState} />
        </div>
      </div>
    </header>
  )
}
