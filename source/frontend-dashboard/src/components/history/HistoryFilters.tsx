import { useState } from 'react'
import type { EventClassification, HistoryFilterRule, FilterRuleCategory, FilterRuleMode } from '../../types/seismic'

interface HistoryFiltersProps {
  value: HistoryFilterRule[]
  availableSensors: string[]
  availableRegions: string[]
  onChange: (next: HistoryFilterRule[]) => void
}

const EVENT_TYPE_OPTIONS: Array<{ label: string; value: EventClassification }> = [
  { label: 'Earthquake', value: 'EARTHQUAKE' },
  { label: 'Conventional Explosion', value: 'CONVENTIONAL_EXPLOSION' },
  { label: 'Nuclear-like Event', value: 'NUCLEAR_LIKE' },
]

const categoryLabel: Record<FilterRuleCategory, string> = {
  type: 'EVENT TYPE',
  sensor: 'SENSOR',
  region: 'REGION',
}

const eventTypeLabel: Record<EventClassification, string> = {
  EARTHQUAKE: 'EARTHQUAKE',
  CONVENTIONAL_EXPLOSION: 'CONVENTIONAL EXPLOSION',
  NUCLEAR_LIKE: 'NUCLEAR-LIKE EVENT',
}

const ruleText = (rule: HistoryFilterRule): string => {
  const normalizedValue = rule.category === 'type'
    ? eventTypeLabel[rule.value as EventClassification] ?? rule.value
    : rule.value.toUpperCase()

  if (rule.mode === 'include') {
    return `${categoryLabel[rule.category]} IS ${normalizedValue}`
  }

  return `${categoryLabel[rule.category]} IS NOT ${normalizedValue}`
}

export const HistoryFiltersPanel = ({ value, availableSensors, availableRegions, onChange }: HistoryFiltersProps) => {
  const [eventTypeInput, setEventTypeInput] = useState<EventClassification>('EARTHQUAKE')
  const [sensorInput, setSensorInput] = useState('')
  const [regionInput, setRegionInput] = useState('')

  const addRule = (category: FilterRuleCategory, mode: FilterRuleMode, rawValue: string) => {
    const normalized = rawValue.trim()
    if (!normalized) {
      return
    }

    const duplicateExists = value.some(
      (rule) => rule.category === category && rule.mode === mode && rule.value.toLowerCase() === normalized.toLowerCase(),
    )

    if (duplicateExists) {
      return
    }

    onChange([...value, { category, mode, value: normalized }])
  }

  const removeRule = (index: number) => {
    onChange(value.filter((_, ruleIndex) => ruleIndex !== index))
  }

  return (
    <aside className="tactical-panel h-fit space-y-4 bg-[#0a0a0a] p-4 font-mono">
      <h2 className="section-greeble text-sm uppercase tracking-[0.3em] text-zinc-200">Filters</h2>

      <label className="block space-y-1 text-xs uppercase tracking-[0.16em] text-zinc-400">
        <span>Event Type</span>
        <div className="flex gap-1">
          <select
            className="cyber-input min-w-0 flex-1 border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs uppercase tracking-[0.08em] text-zinc-100"
            value={eventTypeInput}
            onChange={(event) => setEventTypeInput(event.target.value as EventClassification)}
          >
            {EVENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="cyber-button border border-cyan-500/70 bg-cyan-500/10 px-2 text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-500/20"
            onClick={() => addRule('type', 'include', eventTypeInput)}
          >
            +
          </button>
          <button
            type="button"
            className="cyber-button border border-rose-500/70 bg-rose-500/10 px-2 text-[10px] uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/20"
            onClick={() => addRule('type', 'exclude', eventTypeInput)}
          >
            -
          </button>
        </div>
      </label>

      <label className="block space-y-1 text-xs uppercase tracking-[0.16em] text-zinc-400">
        <span>Sensor ID</span>
        <div className="flex gap-1">
          <input
            className="cyber-input min-w-0 flex-1 border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs uppercase tracking-[0.08em] text-zinc-100"
            list="sensor-options"
            value={sensorInput}
            onChange={(event) => setSensorInput(event.target.value)}
            placeholder="S-01"
          />
          <button
            type="button"
            className="cyber-button border border-cyan-500/70 bg-cyan-500/10 px-2 text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-500/20"
            onClick={() => addRule('sensor', 'include', sensorInput)}
          >
            +
          </button>
          <button
            type="button"
            className="cyber-button border border-rose-500/70 bg-rose-500/10 px-2 text-[10px] uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/20"
            onClick={() => addRule('sensor', 'exclude', sensorInput)}
          >
            -
          </button>
        </div>
        <datalist id="sensor-options">
          {availableSensors.map((sensor) => (
            <option key={sensor} value={sensor} />
          ))}
        </datalist>
      </label>

      <label className="block space-y-1 text-xs uppercase tracking-[0.16em] text-zinc-400">
        <span>Region</span>
        <div className="flex gap-1">
          <input
            className="cyber-input min-w-0 flex-1 border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs uppercase tracking-[0.08em] text-zinc-100"
            list="region-options"
            value={regionInput}
            onChange={(event) => setRegionInput(event.target.value)}
            placeholder="NORTH CORRIDOR"
          />
          <button
            type="button"
            className="cyber-button border border-cyan-500/70 bg-cyan-500/10 px-2 text-[10px] uppercase tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-500/20"
            onClick={() => addRule('region', 'include', regionInput)}
          >
            +
          </button>
          <button
            type="button"
            className="cyber-button border border-rose-500/70 bg-rose-500/10 px-2 text-[10px] uppercase tracking-[0.14em] text-rose-300 transition hover:bg-rose-500/20"
            onClick={() => addRule('region', 'exclude', regionInput)}
          >
            -
          </button>
        </div>
        <datalist id="region-options">
          {availableRegions.map((region) => (
            <option key={region} value={region} />
          ))}
        </datalist>
      </label>

      <section className="space-y-2 border border-zinc-700/80 bg-zinc-950/60 p-2">
        <h3 className="section-greeble text-xs uppercase tracking-[0.22em] text-zinc-300">Active Filters</h3>

        {value.length === 0 ? (
          <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">No active rules.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {value.map((rule, index) => (
              <div
                key={`${rule.category}-${rule.mode}-${rule.value}-${index}`}
                className={
                  rule.mode === 'include'
                    ? 'inline-flex items-center gap-2 border border-cyan-400/70 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.22)]'
                    : 'inline-flex items-center gap-2 border border-rose-500/80 bg-rose-600/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-200 shadow-[0_0_10px_rgba(225,29,72,0.2)]'
                }
              >
                <span className={rule.mode === 'exclude' ? 'line-through decoration-rose-300/70' : ''}>{ruleText(rule)}</span>
                <button
                  type="button"
                  className="border border-current px-1 leading-none text-[10px]"
                  onClick={() => removeRule(index)}
                  aria-label={`Remove ${ruleText(rule)}`}
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}
