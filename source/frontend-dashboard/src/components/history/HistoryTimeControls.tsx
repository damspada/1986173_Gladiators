import type { HistoryTimeFilter, HistoryTimePreset } from '../../types/seismic'

interface HistoryTimeControlsProps {
  value: HistoryTimeFilter
  onChange: (next: HistoryTimeFilter) => void
  anchorMs: number
}

const PRESETS: Array<{ label: string; value: Exclude<HistoryTimePreset, null>; durationMs: number }> = [
  { label: 'Ultima 1h', value: '1h', durationMs: 60 * 60 * 1000 },
  { label: 'Ultime 6h', value: '6h', durationMs: 6 * 60 * 60 * 1000 },
  { label: 'Ultime 24h', value: '24h', durationMs: 24 * 60 * 60 * 1000 },
  { label: 'Ultimi 7 giorni', value: '7d', durationMs: 7 * 24 * 60 * 60 * 1000 },
]

const pad = (value: number): string => String(value).padStart(2, '0')

const toUtcDateTimeLocal = (ms: number): string => {
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear()
  const mm = pad(d.getUTCMonth() + 1)
  const dd = pad(d.getUTCDate())
  const hh = pad(d.getUTCHours())
  const min = pad(d.getUTCMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export const HistoryTimeControls = ({ value, onChange, anchorMs }: HistoryTimeControlsProps) => {
  const applyPreset = (preset: Exclude<HistoryTimePreset, null>, durationMs: number) => {
    const toMs = anchorMs
    const fromMs = Math.max(0, toMs - durationMs)

    onChange({
      fromUtc: toUtcDateTimeLocal(fromMs),
      toUtc: toUtcDateTimeLocal(toMs),
      preset,
    })
  }

  return (
    <section className="tactical-panel space-y-3 bg-[#0a0a0a] p-3 font-mono">
      <div className="space-y-2">
        <p className="section-greeble text-[11px] uppercase tracking-[0.2em] text-zinc-300">Time Quick Presets (UTC)</p>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={
                value.preset === preset.value
                  ? 'cyber-button border border-cyan-400/80 bg-cyan-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-200'
                  : 'cyber-button border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300 transition hover:border-cyan-400/60 hover:text-cyan-200'
              }
              onClick={() => applyPreset(preset.value, preset.durationMs)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="cyber-button border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            onClick={() => onChange({ fromUtc: '', toUtc: '', preset: null })}
          >
            Reset Time
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="space-y-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          <span>Da (UTC)</span>
          <input
            type="datetime-local"
            className="cyber-input w-full border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-100"
            value={value.fromUtc}
            onChange={(event) => onChange({ ...value, fromUtc: event.target.value, preset: null })}
          />
        </label>

        <label className="space-y-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          <span>A (UTC)</span>
          <input
            type="datetime-local"
            className="cyber-input w-full border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs text-zinc-100"
            value={value.toUtc}
            onChange={(event) => onChange({ ...value, toUtc: event.target.value, preset: null })}
          />
        </label>
      </div>

      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        All timestamps are interpreted in UTC (ISO-8601 from backend).
      </p>
    </section>
  )
}
