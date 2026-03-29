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
    <section className="tactical-panel module-reveal space-y-4 p-4">
      <div className="space-y-2">
        <p className="micro-label">Time Quick Presets (UTC)</p>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={
                value.preset === preset.value
                  ? 'rounded-xl border border-cyan-200/55 bg-cyan-300/18 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100'
                  : 'liquid-hover rounded-xl border border-slate-200/15 bg-slate-900/45 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-200/45 hover:text-cyan-100'
              }
              onClick={() => applyPreset(preset.value, preset.durationMs)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="liquid-hover rounded-xl border border-slate-200/15 bg-slate-900/45 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            onClick={() => onChange({ fromUtc: '', toUtc: '', preset: null })}
          >
            Reset Time
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
          <span>Da (UTC)</span>
          <input
            type="datetime-local"
            className="w-full rounded-xl border border-slate-200/15 bg-slate-900/45 px-3 py-2 text-xs text-zinc-100"
            value={value.fromUtc}
            onChange={(event) => onChange({ ...value, fromUtc: event.target.value, preset: null })}
          />
        </label>

        <label className="space-y-1 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
          <span>A (UTC)</span>
          <input
            type="datetime-local"
            className="w-full rounded-xl border border-slate-200/15 bg-slate-900/45 px-3 py-2 text-xs text-zinc-100"
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
