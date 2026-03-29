import { useCallback, useEffect, useState } from 'react'
import { classifyByFrequency } from '../utils/classification'
import type { ConnectionState, SeismicEvent, SensorMeta, StreamSnapshot } from '../types/seismic'

const MAX_LIVE_EVENTS = 600
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 10000

interface RawStreamPayload {
  event_id?: string
  sensor_id: string
  timestamp: string
  frequency: number
  amplitude?: number
  lat?: number
  long?: number
  region?: string
}

interface UseSeismicStreamOptions {
  socketUrl?: string
  historyBootstrapUrl?: string
  historyBootstrapLimit?: number
}

interface RawHistoryPayload {
  event_id: string
  sensor_id: string
  timestamp: string
  frequency: number
  classification?: SeismicEvent['classification']
  amplitude?: number
  sensor?: SensorMeta
}

const resolveSocketUrl = (socketUrl?: string): string | undefined => {
  const trimmedUrl = socketUrl?.trim()
  if (!trimmedUrl) {
    return undefined
  }

  if (trimmedUrl.startsWith('ws://') || trimmedUrl.startsWith('wss://')) {
    return trimmedUrl
  }

  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    try {
      const parsedUrl = new URL(trimmedUrl)
      parsedUrl.protocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      return parsedUrl.toString()
    } catch {
      return trimmedUrl
    }
  }

  if (trimmedUrl.startsWith('/')) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}${trimmedUrl}`
  }

  return trimmedUrl
}

const buildEventKey = (payload: RawStreamPayload): string => {
  const roundedFreq = payload.frequency.toFixed(2)
  return `${payload.sensor_id}:${payload.timestamp}:${roundedFreq}`
}

const asSensorMeta = (payload: RawStreamPayload): SensorMeta | undefined => {
  if (typeof payload.lat !== 'number' || typeof payload.long !== 'number') {
    return undefined
  }

  return {
    sensor_id: payload.sensor_id,
    lat: payload.lat,
    long: payload.long,
    region: payload.region ?? 'UNSPECIFIED',
  }
}

const normalizePayload = (payload: RawStreamPayload): SeismicEvent => {
  const classification = classifyByFrequency(payload.frequency)
  const sensor = asSensorMeta(payload)

  return {
    event_id: payload.event_id ?? buildEventKey(payload),
    sensor_id: payload.sensor_id,
    timestamp: payload.timestamp,
    frequency: payload.frequency,
    amplitude: payload.amplitude,
    classification,
    sensor,
  }
}

const normalizeHistoryPayload = (payload: RawHistoryPayload): SeismicEvent => {
  return {
    event_id: payload.event_id,
    sensor_id: payload.sensor_id,
    timestamp: payload.timestamp,
    frequency: payload.frequency,
    classification: payload.classification ?? classifyByFrequency(payload.frequency),
    amplitude: payload.amplitude,
    sensor: payload.sensor,
  }
}

const mergeEvents = (current: SeismicEvent[], incoming: SeismicEvent[]): SeismicEvent[] => {
  const merged = new Map<string, SeismicEvent>()

  for (const event of [...incoming, ...current]) {
    const key = event.event_id || buildEventKey(event)
    if (!merged.has(key)) {
      merged.set(key, event)
    }
  }

  return [...merged.values()]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_LIVE_EVENTS)
}

const buildBootstrapUrl = (baseUrl: string, limit: number): string => {
  try {
    const url = new URL(baseUrl)
    url.searchParams.set('limit', String(limit))
    return url.toString()
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}limit=${limit}`
  }
}

export const useSeismicStream = ({
  socketUrl,
  historyBootstrapUrl,
  historyBootstrapLimit = 50,
}: UseSeismicStreamOptions): StreamSnapshot & { forceReconnect: () => void } => {
  const normalizedSocketUrl = resolveSocketUrl(socketUrl)
  const normalizedHistoryUrl = historyBootstrapUrl?.trim()
  const hasConfiguredSocketUrl = Boolean(normalizedSocketUrl)

  const [events, setEvents] = useState<SeismicEvent[]>([])
  const [sensors, setSensors] = useState<SensorMeta[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    hasConfiguredSocketUrl ? 'connecting' : 'error',
  )
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const [lastError, setLastError] = useState<string | undefined>(
    hasConfiguredSocketUrl ? undefined : 'Missing VITE_LIVE_WS_URL configuration.',
  )
  const [disconnectHistory, setDisconnectHistory] = useState<StreamSnapshot['disconnectHistory']>([])
  const [reconnectCount, setReconnectCount] = useState(0)
  const [maxDisconnectMs, setMaxDisconnectMs] = useState(0)
  const [totalDisconnectMs, setTotalDisconnectMs] = useState(0)
  const [sessionStartedAt] = useState(() => new Date().toISOString())
  const [tickMs, setTickMs] = useState(() => Date.now())
  const [currentFaultType, setCurrentFaultType] = useState<StreamSnapshot['currentFaultType']>(
    hasConfiguredSocketUrl ? 'unknown' : 'configuration',
  )
  const [reconnectSignal, setReconnectSignal] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTickMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!normalizedSocketUrl) {
      return
    }

    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let currentAttempt = 0
    let isMounted = true
    let manualClose = false
    let disconnectStartedAtMs: number | null = null

    const dedupeKeys = new Set<string>()

    const loadBootstrapHistory = async () => {
      if (!normalizedHistoryUrl) {
        return
      }

      try {
        const url = buildBootstrapUrl(normalizedHistoryUrl, historyBootstrapLimit)
        const response = await fetch(url)
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as RawHistoryPayload[]
        const normalizedBatch = payload
          .slice(0, historyBootstrapLimit)
          .map(normalizeHistoryPayload)

        if (!isMounted || normalizedBatch.length === 0) {
          return
        }

        setEvents((previousEvents) => mergeEvents(previousEvents, normalizedBatch))

        setSensors((previousSensors) => {
          const nextMap = new Map(previousSensors.map((sensor) => [sensor.sensor_id, sensor]))
          for (const event of normalizedBatch) {
            if (event.sensor) {
              nextMap.set(event.sensor.sensor_id, event.sensor)
            }
          }
          return [...nextMap.values()]
        })
      } catch {
        // Bootstrap is best-effort and should not break live streaming state.
      }
    }

    const connect = (attempt: number) => {
      if (!isMounted) {
        return
      }

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      if (socket) {
        socket.close()
        socket = null
      }

      currentAttempt = attempt
      setConnectionState(attempt === 0 ? 'connecting' : 'reconnecting')
      setReconnectAttempt(attempt)

      const queueReconnect = (errorMessage: string) => {
        if (!isMounted || manualClose || reconnectTimer !== null) {
          return
        }

        setConnectionState('reconnecting')
        setCurrentFaultType('network')
        setLastError(errorMessage)

        const nextAttempt = currentAttempt + 1
        currentAttempt = nextAttempt
        setReconnectAttempt(nextAttempt)
        setReconnectCount((previous) => previous + 1)

        if (disconnectStartedAtMs === null) {
          disconnectStartedAtMs = Date.now()
        }

        const delay = Math.min(BASE_DELAY_MS * 2 ** (nextAttempt - 1), MAX_DELAY_MS)
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null
          connect(nextAttempt)
        }, delay)
      }

      try {
        socket = new WebSocket(normalizedSocketUrl)

        socket.onopen = () => {
          if (!isMounted) {
            return
          }

          currentAttempt = 0
          setConnectionState('connected')
          setReconnectAttempt(0)
          setLastError(undefined)
          setCurrentFaultType('unknown')

          if (disconnectStartedAtMs !== null) {
            const endedAtMs = Date.now()
            const durationMs = Math.max(0, endedAtMs - disconnectStartedAtMs)

            setDisconnectHistory((previous) => {
              const next = [
                {
                  startedAt: new Date(disconnectStartedAtMs as number).toISOString(),
                  endedAt: new Date(endedAtMs).toISOString(),
                  durationMs,
                  faultType: 'network' as const,
                },
                ...previous,
              ]

              return next.slice(0, 8)
            })
            setTotalDisconnectMs((previous) => previous + durationMs)
            setMaxDisconnectMs((previous) => Math.max(previous, durationMs))
            disconnectStartedAtMs = null
          }
        }

        socket.onmessage = (message) => {
          if (!isMounted) {
            return
          }

          try {
            const payload = JSON.parse(message.data as string) as RawStreamPayload
            if (!payload.sensor_id || !payload.timestamp || typeof payload.frequency !== 'number') {
              return
            }

            const eventKey = buildEventKey(payload)
            if (dedupeKeys.has(eventKey)) {
              return
            }

            dedupeKeys.add(eventKey)
            const normalized = normalizePayload(payload)

            if (normalized.sensor) {
              const nextSensor = normalized.sensor
              setSensors((previousSensors) => {
                const index = previousSensors.findIndex(
                  (sensor) => sensor.sensor_id === nextSensor.sensor_id,
                )

                if (index === -1) {
                  return [...previousSensors, nextSensor]
                }

                const nextSensors = [...previousSensors]
                nextSensors[index] = nextSensor
                return nextSensors
              })
            }

            setEvents((previousEvents) => {
              const nextEvents = mergeEvents(previousEvents, [normalized])

              if (dedupeKeys.size > MAX_LIVE_EVENTS * 3) {
                const freshKeys = new Set<string>()
                for (const event of nextEvents) {
                  freshKeys.add(buildEventKey(event))
                }

                dedupeKeys.clear()
                for (const key of freshKeys) {
                  dedupeKeys.add(key)
                }
              }

              return nextEvents
            })
          } catch {
            setLastError('Failed to parse incoming stream payload.')
          }
        }

        socket.onerror = () => {
          queueReconnect('Socket error detected.')
        }

        socket.onclose = () => {
          queueReconnect('Socket closed unexpectedly.')
        }
      } catch {
        if (!isMounted) {
          return
        }

        setConnectionState('error')
        setLastError('Unable to initialize socket connection.')
        setCurrentFaultType('configuration')
      }
    }

    void loadBootstrapHistory()
    connect(0)

    return () => {
      isMounted = false
      manualClose = true

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
      }

      if (socket) {
        socket.close()
      }
    }
  }, [historyBootstrapLimit, normalizedHistoryUrl, normalizedSocketUrl, reconnectSignal])

  const forceReconnect = useCallback(() => {
    setReconnectSignal((value) => value + 1)
  }, [])

  const sessionStartedMs = Date.parse(sessionStartedAt)
  const sessionUptimeMs = Number.isNaN(sessionStartedMs)
    ? 0
    : Math.max(0, tickMs - sessionStartedMs - totalDisconnectMs)
  const estimatedLostEvents = Math.max(0, Math.round(totalDisconnectMs / 500))

  return {
    connectionState,
    reconnectAttempt,
    events,
    sensors,
    lastError,
    disconnectHistory,
    currentFaultType,
    missionMetrics: {
      sessionStartedAt,
      uptimeMs: sessionUptimeMs,
      reconnectCount,
      maxDisconnectMs,
      estimatedLostEvents,
    },
    forceReconnect,
  }
}
