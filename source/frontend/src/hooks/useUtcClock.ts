import { useEffect, useState } from 'react'
import { useTimezone } from '../contexts/TimezoneContext'
import { formatUtcTimestamp } from '../utils/format'

export const useUtcClock = (): string => {
  const { timezone } = useTimezone()
  const [now, setNow] = useState(() => formatUtcTimestamp(new Date().toISOString(), timezone))

  useEffect(() => {
    setNow(formatUtcTimestamp(new Date().toISOString(), timezone))
    const id = window.setInterval(() => {
      setNow(formatUtcTimestamp(new Date().toISOString(), timezone))
    }, 1000)
    return () => window.clearInterval(id)
  }, [timezone])

  return now
}
