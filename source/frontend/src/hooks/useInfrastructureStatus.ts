import { useEffect, useState } from 'react'
import type { InfrastructureStatus } from '../types/seismic'

interface InfrastructureState {
  status: InfrastructureStatus | null
  loading: boolean
  error: string | null
}

const DEFAULT_POLL_MS = 8000

const asStatusUrl = (historyApiUrl?: string): string | null => {
  const trimmed = historyApiUrl?.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    parsed.pathname = '/api/infrastructure/status'
    parsed.search = ''
    return parsed.toString()
  } catch {
    return null
  }
}

export const useInfrastructureStatus = (
  historyApiUrl?: string,
  pollIntervalMs: number = DEFAULT_POLL_MS,
): InfrastructureState => {
  const [state, setState] = useState<InfrastructureState>({
    status: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const url = asStatusUrl(historyApiUrl)
    if (!url) {
      setState({
        status: null,
        loading: false,
        error: 'Infrastructure endpoint unavailable: set VITE_HISTORY_API_URL.',
      })
      return
    }

    let active = true

    const refresh = async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Infra status failed with status ${response.status}.`)
        }

        const payload = (await response.json()) as InfrastructureStatus
        if (!active) {
          return
        }

        setState({
          status: payload,
          loading: false,
          error: null,
        })
      } catch (err: unknown) {
        if (!active) {
          return
        }

        setState((previous) => ({
          status: previous.status,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to refresh infrastructure status.',
        }))
      }
    }

    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, pollIntervalMs)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [historyApiUrl, pollIntervalMs])

  return state
}
