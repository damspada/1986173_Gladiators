import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import {
  ALERT_SEVERITY_ORDER,
  alertSeverityLabel,
  normalizeAlertPreferences,
  type AlertPreferences,
  type AlertSeverity,
} from '../../utils/alerting'
import { playAlertTone } from '../../utils/alertAudio'

interface AlertSettingsMenuProps {
  activeAlertSeverity: AlertSeverity | null
  alertPreferences: AlertPreferences
  onAlertPreferencesChange: (next: AlertPreferences) => void
}

export const AlertSettingsMenu = ({
  activeAlertSeverity,
  alertPreferences,
  onAlertPreferencesChange,
}: AlertSettingsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [thresholdDraft, setThresholdDraft] = useState(() => ({
    low: String(alertPreferences.thresholds.low),
    medium: String(alertPreferences.thresholds.medium),
    high: String(alertPreferences.thresholds.high),
    critical: String(alertPreferences.thresholds.critical),
    cooldownSeconds: String(Math.round(alertPreferences.cooldownMs / 1000)),
    visualDurationSeconds: String((alertPreferences.visualDurationMs / 1000).toFixed(1)),
    visualMinSeverity: alertPreferences.visualMinSeverity,
    audioMinSeverity: alertPreferences.audioMinSeverity,
    audioVolume: String(alertPreferences.audioVolume),
    reAlertOnStable: alertPreferences.reAlertOnStable,
  }))
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setThresholdDraft({
      low: String(alertPreferences.thresholds.low),
      medium: String(alertPreferences.thresholds.medium),
      high: String(alertPreferences.thresholds.high),
      critical: String(alertPreferences.thresholds.critical),
      cooldownSeconds: String(Math.round(alertPreferences.cooldownMs / 1000)),
        visualDurationSeconds: String((alertPreferences.visualDurationMs / 1000).toFixed(1)),
        visualMinSeverity: alertPreferences.visualMinSeverity,
        audioMinSeverity: alertPreferences.audioMinSeverity,
        audioVolume: String(alertPreferences.audioVolume),
        reAlertOnStable: alertPreferences.reAlertOnStable,
    })
  }, [alertPreferences])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const applyAlertSettings = () => {
    const parsed = {
      thresholds: {
        low: Number.parseFloat(thresholdDraft.low),
        medium: Number.parseFloat(thresholdDraft.medium),
        high: Number.parseFloat(thresholdDraft.high),
        critical: Number.parseFloat(thresholdDraft.critical),
      },
      visualEnabled: alertPreferences.visualEnabled,
      audioEnabled: alertPreferences.audioEnabled,
      cooldownMs: Number.parseFloat(thresholdDraft.cooldownSeconds) * 1000,
        visualDurationMs: Number.parseFloat(thresholdDraft.visualDurationSeconds) * 1000,
        visualMinSeverity: thresholdDraft.visualMinSeverity,
        audioMinSeverity: thresholdDraft.audioMinSeverity,
        audioVolume: Number.parseFloat(thresholdDraft.audioVolume),
        reAlertOnStable: thresholdDraft.reAlertOnStable,
    }

    const hasInvalid =
      Number.isNaN(parsed.thresholds.low) ||
      Number.isNaN(parsed.thresholds.medium) ||
      Number.isNaN(parsed.thresholds.high) ||
      Number.isNaN(parsed.thresholds.critical) ||
      Number.isNaN(parsed.cooldownMs) ||
      Number.isNaN(parsed.visualDurationMs) ||
      Number.isNaN(parsed.audioVolume)

    onAlertPreferencesChange(normalizeAlertPreferences(parsed))
    setSettingsMessage(hasInvalid ? 'Invalid values replaced with defaults.' : 'Alert settings updated.')
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className={clsx(
          'relative rounded-sm border bg-zinc-900/70 px-2.5 py-1 text-[11px] tracking-[0.12em] transition',
          activeAlertSeverity
            ? 'border-rose-400/80 text-rose-200'
            : 'border-zinc-700 text-zinc-300 hover:border-cyan-400/70 hover:text-cyan-200',
        )}
        onClick={() => setIsOpen((value) => !value)}
        aria-label="Alert settings menu"
        aria-expanded={isOpen}
      >
        🔔
      </button>

        {isOpen ? (
          <div className="absolute right-0 top-full z-50 mt-1 w-[min(92vw,28rem)] rounded-sm border border-zinc-700 bg-zinc-900 p-3 text-[10px] shadow-xl">
            <div className="mb-2 flex items-center justify-between border-b border-zinc-700/80 pb-2 text-[10px] uppercase tracking-[0.12em] text-zinc-300">
            <span>Alert Settings</span>
            <span className="text-zinc-400">
              {activeAlertSeverity ? `${alertSeverityLabel[activeAlertSeverity]} active` : 'Monitoring'}
            </span>
          </div>

            <div className="grid grid-cols-2 gap-2 rounded-sm border border-zinc-700/80 bg-zinc-950/60 p-2 text-[10px] uppercase tracking-[0.1em] text-zinc-300">
            <label className="flex flex-col gap-1">
              <span>Low</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={thresholdDraft.low}
                onChange={(event) => setThresholdDraft((current) => ({ ...current, low: event.target.value }))}
                className="rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Medium</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={thresholdDraft.medium}
                onChange={(event) => setThresholdDraft((current) => ({ ...current, medium: event.target.value }))}
                className="rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>High</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={thresholdDraft.high}
                onChange={(event) => setThresholdDraft((current) => ({ ...current, high: event.target.value }))}
                className="rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Critical</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={thresholdDraft.critical}
                onChange={(event) => setThresholdDraft((current) => ({ ...current, critical: event.target.value }))}
                className="rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
              />
            </label>
          </div>

            <div className="mt-2 grid gap-2 rounded-sm border border-zinc-700/80 bg-zinc-950/60 p-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.1em] text-zinc-300">
                  <span>Cooldown (seconds)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={thresholdDraft.cooldownSeconds}
                    onChange={(event) => setThresholdDraft((current) => ({ ...current, cooldownSeconds: event.target.value }))}
                    className="rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.1em] text-zinc-300">
                  <span>Notice (seconds)</span>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={thresholdDraft.visualDurationSeconds}
                    onChange={(event) => setThresholdDraft((current) => ({ ...current, visualDurationSeconds: event.target.value }))}
                    className="rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
                  />
                </label>
              </div>
              <label className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-zinc-300">
                <input
                  type="checkbox"
                  checked={thresholdDraft.reAlertOnStable}
                  onChange={(event) => setThresholdDraft((current) => ({ ...current, reAlertOnStable: event.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800"
                />
                Re-alert after cooldown (same severity)
              </label>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 rounded-sm border border-zinc-700/80 bg-zinc-950/60 p-2">
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.1em] text-zinc-300">
                <span>Visual minimum</span>
                <select
                  value={thresholdDraft.visualMinSeverity}
                  onChange={(event) => setThresholdDraft((current) => ({ ...current, visualMinSeverity: event.target.value as AlertSeverity }))}
                  className="rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
                >
                  {ALERT_SEVERITY_ORDER.map((severity) => (
                    <option key={severity} value={severity}>{alertSeverityLabel[severity]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.1em] text-zinc-300">
                <span>Audio minimum</span>
                <select
                  value={thresholdDraft.audioMinSeverity}
                  onChange={(event) => setThresholdDraft((current) => ({ ...current, audioMinSeverity: event.target.value as AlertSeverity }))}
                  className="rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100"
                >
                  {ALERT_SEVERITY_ORDER.map((severity) => (
                    <option key={severity} value={severity}>{alertSeverityLabel[severity]}</option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-[10px] uppercase tracking-[0.1em] text-zinc-300">
                <span>Audio volume: {thresholdDraft.audioVolume}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={thresholdDraft.audioVolume}
                  onChange={(event) => setThresholdDraft((current) => ({ ...current, audioVolume: event.target.value }))}
                  className="accent-cyan-400"
                />
              </label>
            </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
            <button
              type="button"
              className={clsx(
                'rounded-sm border px-2 py-1 transition',
                alertPreferences.visualEnabled
                  ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                  : 'border-zinc-700 bg-zinc-900/70 text-zinc-400',
              )}
              onClick={() => onAlertPreferencesChange({
                ...alertPreferences,
                visualEnabled: !alertPreferences.visualEnabled,
              })}
            >
              Visual {alertPreferences.visualEnabled ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className={clsx(
                'rounded-sm border px-2 py-1 transition',
                alertPreferences.audioEnabled
                  ? 'border-cyan-500/70 bg-cyan-500/10 text-cyan-300'
                  : 'border-zinc-700 bg-zinc-900/70 text-zinc-400',
              )}
              onClick={() => onAlertPreferencesChange({
                ...alertPreferences,
                audioEnabled: !alertPreferences.audioEnabled,
              })}
            >
              Audio {alertPreferences.audioEnabled ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className="rounded-sm border border-cyan-500/70 bg-cyan-500/10 px-3 py-1 text-cyan-300 transition hover:bg-cyan-500/20"
              onClick={applyAlertSettings}
            >
              Apply
            </button>
              <button
                type="button"
                className="rounded-sm border border-zinc-700 bg-zinc-800 px-3 py-1 text-zinc-200 transition hover:border-cyan-400/70 hover:text-cyan-200"
                onClick={() => playAlertTone('high', Number.parseFloat(thresholdDraft.audioVolume))}
              >
                Test Audio
              </button>
          </div>

          {settingsMessage ? (
            <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-zinc-400">{settingsMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
