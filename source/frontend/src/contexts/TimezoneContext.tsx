import { createContext, useContext, useState, type ReactNode } from 'react'

const TIMEZONE_STORAGE_KEY = 'gsm-timezone-v1'

interface TimezoneContextValue {
  timezone: string
  setTimezone: (tz: string) => void
}

const TimezoneContext = createContext<TimezoneContextValue>({
  timezone: 'UTC',
  setTimezone: () => undefined,
})

const readStoredTimezone = (): string => {
  try {
    return window.localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? 'UTC'
  } catch {
    return 'UTC'
  }
}

export const TimezoneProvider = ({ children }: { children: ReactNode }) => {
  const [timezone, setTimezoneState] = useState<string>(() => readStoredTimezone())

  const setTimezone = (tz: string) => {
    setTimezoneState(tz)
    try {
      window.localStorage.setItem(TIMEZONE_STORAGE_KEY, tz)
    } catch {
      // ignore
    }
  }

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  )
}

export const useTimezone = () => useContext(TimezoneContext)

export const TIMEZONE_OPTIONS: { label: string; value: string }[] = [
  { label: 'UTC', value: 'UTC' },
  { label: 'New York (ET)', value: 'America/New_York' },
  { label: 'Chicago (CT)', value: 'America/Chicago' },
  { label: 'Denver (MT)', value: 'America/Denver' },
  { label: 'Los Angeles (PT)', value: 'America/Los_Angeles' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Paris / Berlin (CET)', value: 'Europe/Paris' },
  { label: 'Moscow (MSK)', value: 'Europe/Moscow' },
  { label: 'Dubai (GST)', value: 'Asia/Dubai' },
  { label: 'India (IST)', value: 'Asia/Kolkata' },
  { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Sydney (AEST)', value: 'Australia/Sydney' },
]
