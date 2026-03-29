import { useEffect, useRef, useState } from 'react'

type ThemeMode = 'dark' | 'light'
type ThemePattern = 'classic' | 'amber' | 'emerald'

interface ThemeMenuProps {
  themeMode: ThemeMode
  themePattern: ThemePattern
  onChangeThemePattern: (pattern: ThemePattern) => void
  onToggleThemeMode: () => void
  onResetTheme: () => void
}

export const ThemeMenu = ({
  themeMode,
  themePattern,
  onChangeThemePattern,
  onToggleThemeMode,
  onResetTheme,
}: ThemeMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="rounded-sm border border-zinc-700 bg-zinc-900/70 px-2.5 py-1 text-[11px] tracking-[0.12em] text-zinc-300 transition hover:border-cyan-400/70 hover:text-cyan-200"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Theme settings menu"
        aria-expanded={isOpen}
      >
        ⚙
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 rounded-sm border border-zinc-700 bg-zinc-900 p-2 text-[10px] shadow-lg min-w-[140px]">
          <div className="space-y-2">
            {/* Pattern Select */}
            <div>
              <label htmlFor="theme-pattern" className="block text-[9px] uppercase tracking-[0.1em] text-zinc-400 mb-1">
                Pattern
              </label>
              <select
                id="theme-pattern"
                value={themePattern}
                className="w-full rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] tracking-[0.08em] text-zinc-200 transition hover:border-cyan-400/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300"
                onChange={(event) => {
                  onChangeThemePattern(event.target.value as ThemePattern)
                }}
              >
                <option value="classic">Classic</option>
                <option value="amber">Amber</option>
                <option value="emerald">Emerald</option>
              </select>
            </div>

            {/* Mode Toggle */}
            <button
              type="button"
              className="w-full rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-300 transition hover:border-cyan-400/70 hover:text-cyan-200"
              onClick={() => {
                onToggleThemeMode()
              }}
            >
              {themeMode === 'dark' ? '☀ Light' : '🌙 Dark'}
            </button>

            {/* Reset Button */}
            <button
              type="button"
              className="w-full rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-300 transition hover:border-cyan-400/70 hover:text-cyan-200"
              onClick={() => {
                onResetTheme()
                setIsOpen(false)
              }}
            >
              ↻ Reset
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
