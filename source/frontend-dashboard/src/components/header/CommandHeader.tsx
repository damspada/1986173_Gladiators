import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import { StatusDot } from '../common/StatusDot'
import { useUtcClock } from '../../hooks/useUtcClock'
import type { ConnectionState } from '../../types/seismic'

interface CommandHeaderProps {
  connectionState: ConnectionState
  liveConfigWarning?: string
}

export const CommandHeader = ({ connectionState, liveConfigWarning }: CommandHeaderProps) => {
  const utcClock = useUtcClock()

  return (
    <header className="tactical-panel module-reveal border-white/10 px-5 py-5 md:px-8 md:py-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="kicker-label">Global Seismic Intelligence Platform</p>
          <h1 className="display-heading mt-2 text-balance text-slate-100">Depth-Aware Seismic Monitor</h1>
        </div>
        <div className="flex flex-col items-start gap-3 text-xs uppercase tracking-[0.22em] text-zinc-300 md:items-end">
          <nav className="inline-flex rounded-2xl border border-slate-200/15 bg-slate-900/50 p-1.5 text-[10px] tracking-[0.2em] backdrop-blur-md">
            {[
              { to: '/live', label: 'Live' },
              { to: '/history', label: 'History' },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'liquid-hover rounded-xl border border-transparent px-4 py-1.5 text-zinc-300 transition',
                    'hover:border-cyan-200/40 hover:bg-cyan-300/10 hover:text-zinc-100',
                    isActive && 'border-cyan-200/60 bg-cyan-300/20 text-cyan-100 shadow-[0_8px_24px_rgba(30,230,255,0.18)]',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <span className="micro-label rounded-xl border border-slate-200/15 bg-slate-900/45 px-3 py-1.5">UTC {utcClock}</span>
          <StatusDot state={connectionState} />

          {liveConfigWarning ? (
            <span className="max-w-[22rem] rounded-xl border border-rose-300/45 bg-rose-400/10 px-3 py-2 text-[10px] tracking-[0.14em] text-rose-200">
              {liveConfigWarning}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  )
}
