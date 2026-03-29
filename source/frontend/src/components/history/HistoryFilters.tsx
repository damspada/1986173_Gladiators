import React from 'react'
import type { EventClassification, HistoryFilters, HistoryTimeFilter, HistoryTimePreset } from '../../types/seismic'

interface HistoryFiltersProps {
  filters: HistoryFilters
  availableSensors: string[]
  availableRegions: string[]
  timeFilter: HistoryTimeFilter
  anchorMs: number
  loading: boolean
  onFiltersChange: (next: HistoryFilters) => void
  onTimeFilterChange: (next: HistoryTimeFilter) => void
  onRefresh: () => void
}

const PRESETS: Array<{ label: string; value: Exclude<HistoryTimePreset, null>; durationMs: number }> = [
  { label: '1h', value: '1h', durationMs: 60 * 60 * 1000 },
  { label: '6h', value: '6h', durationMs: 6 * 60 * 60 * 1000 },
  { label: '24h', value: '24h', durationMs: 24 * 60 * 60 * 1000 },
  { label: '7d', value: '7d', durationMs: 7 * 24 * 60 * 60 * 1000 },
]

const pad = (v: number) => String(v).padStart(2, '0')
const toUtcDateTimeLocal = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

const SELECT_CLS = 'w-full rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-cyan-500/60'

export const HistoryFiltersPanel = ({
  filters,
  availableSensors,
  availableRegions,
  timeFilter,
  anchorMs,
  loading,
  onFiltersChange,
  onTimeFilterChange,
  onRefresh,
}: HistoryFiltersProps) => {
  const applyPreset = (preset: Exclude<HistoryTimePreset, null>, durationMs: number) => {
    const toMs = anchorMs
    const fromMs = Math.max(0, toMs - durationMs)
    onTimeFilterChange({ fromUtc: toUtcDateTimeLocal(fromMs), toUtc: toUtcDateTimeLocal(toMs), preset })
  }

  return (
    <aside className="tactical-panel h-fit space-y-4 bg-[#0a0a0a] p-4 font-mono">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm uppercase tracking-[0.3em] text-zinc-200">Filters</h2>
        <button
          type="button"
          className="rounded-sm border border-cyan-500/70 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      <label className="block space-y-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        <span>Event Type</span>
        <select
          className={SELECT_CLS}
          value={filters.type}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onFiltersChange({ ...filters, type: e.target.value as EventClassification | 'ALL' })}
        >
          <option value="ALL">All Types</option>
          <option value="EARTHQUAKE">Earthquake</option>
          <option value="CONVENTIONAL_EXPLOSION">Conventional Explosion</option>
          <option value="NUCLEAR_LIKE">Nuclear-like Event</option>
        </select>
      </label>

      <label className="block space-y-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        <span>Sensor ID</span>
        <select
          className={SELECT_CLS}
          value={filters.sensorId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onFiltersChange({ ...filters, sensorId: e.target.value })}
        >
          <option value="">All Sensors</option>
          {availableSensors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        <span>Region</span>
        <select
          className={SELECT_CLS}
          value={filters.region}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onFiltersChange({ ...filters, region: e.target.value })}
        >
          <option value="">All Regions</option>
          {availableRegions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="w-full rounded-sm border border-zinc-700 bg-zinc-800/50 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
        onClick={() => onFiltersChange({ type: 'ALL', sensorId: '', region: '' })}
      >
        Clear Filters
      </button>

      <div className="border-t border-zinc-700/60 pt-4 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">Time Range (UTC)</p>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={
                timeFilter.preset === preset.value
                  ? 'rounded-sm border border-cyan-400/80 bg-cyan-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-200'
                  : 'rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400 transition hover:border-cyan-400/50 hover:text-cyan-300'
              }
              onClick={() => applyPreset(preset.value, preset.durationMs)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
            onClick={() => onTimeFilterChange({ fromUtc: '', toUtc: '', preset: null })}
          >
            Reset
          </button>
        </div>
        <label className="block space-y-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          <span>From</span>
          <input
            type="datetime-local"
            className="w-full rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-cyan-500/60"
            value={timeFilter.fromUtc}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTimeFilterChange({ ...timeFilter, fromUtc: e.target.value, preset: null })}
          />
        </label>
        <label className="block space-y-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          <span>To</span>
          <input
            type="datetime-local"
            className="w-full rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-cyan-500/60"
            value={timeFilter.toUtc}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTimeFilterChange({ ...timeFilter, toUtc: e.target.value, preset: null })}
          />
        </label>
      </div>
    </aside>
  )
}
