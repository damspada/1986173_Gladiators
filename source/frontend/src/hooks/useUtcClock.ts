import { useEffect, useState } from 'react'

export const useUtcClock = (): string => {
  const [utcNow, setUtcNow] = useState(() => new Date().toISOString().replace('T', ' ').replace('Z', ' UTC'))

  useEffect(() => {
    const id = window.setInterval(() => {
      setUtcNow(new Date().toISOString().replace('T', ' ').replace('Z', ' UTC'))
    }, 1000)

    return () => window.clearInterval(id)
  }, [])

  return utcNow
}
