import clsx from 'clsx'
import { Link, NavLink } from 'react-router-dom'
import { StatusDot } from '../common/StatusDot'
import { ThemeMenu } from './ThemeMenu'
import { AlertSettingsMenu } from './AlertSettingsMenu'
import { useUtcClock } from '../../hooks/useUtcClock'
import { useTimezone } from '../../contexts/TimezoneContext'
import { formatUtcTimestamp } from '../../utils/format'
import type { ConnectionState, EventClassification } from '../../types/seismic'
import type { AlertPreferences, AlertSeverity } from '../../utils/alerting'
import { alertSeverityLabel } from '../../utils/alerting'

type ThemeMode = 'dark' | 'light'
type ThemePattern = 'classic' | 'amber' | 'emerald'

interface CommandHeaderProps {
  connectionState: ConnectionState
  onOpenAbout: () => void
  themeMode: ThemeMode
  themePattern: ThemePattern
  onChangeThemePattern: (pattern: ThemePattern) => void
  onToggleThemeMode: () => void
  onResetTheme: () => void
  activeAlertSeverity: AlertSeverity | null
  alertPreferences: AlertPreferences
  onAlertPreferencesChange: (next: AlertPreferences) => void
  infrastructureAlert: {
    tone: 'warning' | 'critical'
    message: string
  } | null
  eventAlert: {
    classification: EventClassification
    severity: AlertSeverity
    frequency: number
    triggeredAt: string
  } | null
}

const eventClassificationLabel: Record<EventClassification, string> = {
  EARTHQUAKE: 'Earthquake',
  CONVENTIONAL_EXPLOSION: 'Conventional Explosion',
  NUCLEAR_LIKE: 'Nuclear-like',
}

export const CommandHeader = ({
  connectionState,
  onOpenAbout,
  themeMode,
  themePattern,
  onChangeThemePattern,
  onToggleThemeMode,
  onResetTheme,
  activeAlertSeverity,
  alertPreferences,
  onAlertPreferencesChange,
  infrastructureAlert,
  eventAlert,
}: CommandHeaderProps) => {
  const utcClock = useUtcClock()
  const { timezone } = useTimezone()
  const isTickerAlert =
    eventAlert?.classification === 'CONVENTIONAL_EXPLOSION' || eventAlert?.classification === 'NUCLEAR_LIKE'
  const eventAlertText = eventAlert
    ? `${eventClassificationLabel[eventAlert.classification]} ${alertSeverityLabel[eventAlert.severity]} alert | Frequency ${eventAlert.frequency.toFixed(2)} Hz | ${formatUtcTimestamp(eventAlert.triggeredAt, timezone)}`
    : ''

  return (
    <header className="tactical-panel relative z-[2100] border-zinc-700/80 px-4 py-4 md:px-6">
      {infrastructureAlert ? (
        <section
          aria-live="polite"
          aria-atomic="true"
          className={clsx(
            'pointer-events-none absolute left-1/2 top-1.5 z-10 -translate-x-1/2 rounded-sm border px-3 py-1 text-[10px] uppercase tracking-[0.14em]',
            infrastructureAlert.tone === 'critical'
              ? 'border-rose-400/80 bg-rose-900/35 text-rose-100'
              : 'border-amber-400/80 bg-amber-900/35 text-amber-100',
          )}
        >
          <span className="font-semibold">Alert:</span> {infrastructureAlert.message}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:min-w-0 md:flex-1">
          <Link to="/live" className="transition-opacity hover:opacity-80">
            <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/90 sm:text-[11px] sm:tracking-[0.42em]">Strategic Theater // Year 2038</p>
            <h1 className="mt-1 text-lg font-semibold tracking-[0.12em] text-zinc-100 sm:text-xl sm:tracking-[0.18em] md:text-2xl">GLOBAL SEISMIC MONITOR</h1>
          </Link>
        </div>

        <div className="flex flex-col items-start gap-2 text-xs uppercase tracking-[0.22em] text-zinc-300 md:items-end">
          <div className="flex items-center gap-2">
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
            <ThemeMenu
              themeMode={themeMode}
              themePattern={themePattern}
              onChangeThemePattern={onChangeThemePattern}
              onToggleThemeMode={onToggleThemeMode}
              onResetTheme={onResetTheme}
            />
            <AlertSettingsMenu
              activeAlertSeverity={activeAlertSeverity}
              alertPreferences={alertPreferences}
              onAlertPreferencesChange={onAlertPreferencesChange}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap rounded-sm border border-zinc-700 bg-zinc-900/70 px-3 py-1">UTC {utcClock}</span>
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

      <div className="mt-3 flex min-h-[2.75rem] items-center justify-center">
        {eventAlert ? (
          <section
            aria-live="polite"
            aria-atomic="true"
            className={clsx(
              'w-full max-w-[38rem] overflow-hidden rounded-sm border px-2 py-1.5',
              eventAlert.classification === 'EARTHQUAKE' && 'border-cyan-300/80 bg-cyan-900/35 text-cyan-100 px-3 py-2',
              eventAlert.classification === 'CONVENTIONAL_EXPLOSION' && 'border-amber-300/80 bg-amber-900/35 text-amber-100',
              eventAlert.classification === 'NUCLEAR_LIKE' && 'border-rose-300/80 bg-rose-900/35 text-rose-100',
            )}
          >
            {isTickerAlert ? (
              <div className="event-news-ticker">
                <div className="event-news-ticker__track">
                  <span className="event-news-ticker__item">{eventAlertText}</span>
                  <span className="event-news-ticker__item" aria-hidden="true">{eventAlertText}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] normal-case tracking-normal">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                  {eventClassificationLabel[eventAlert.classification]}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                  {alertSeverityLabel[eventAlert.severity]} Alert
                </span>
                <span>Frequency {eventAlert.frequency.toFixed(2)} Hz</span>
                <span>{new Date(eventAlert.triggeredAt).toUTCString()}</span>
              </div>
            )}
          </section>
        ) : (
          <div className="w-full max-w-[38rem]" aria-hidden="true" />
        )}
      </div>
    </header>
  )
}
