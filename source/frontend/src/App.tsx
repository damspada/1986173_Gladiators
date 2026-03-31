import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AboutModal } from './components/common/AboutModal'
import { EventDetailsModal } from './components/common/EventDetailsModal'
import { ReconnectingOverlay } from './components/common/ReconnectingOverlay'
import { CommandHeader } from './components/header/CommandHeader'
import { useInfrastructureStatus } from './hooks/useInfrastructureStatus'
import { useSeismicStream } from './hooks/useSeismicStream'
import { HistoryPage } from './pages/HistoryPage'
import { InfrastructurePage } from './pages/InfrastructurePage'
import { LiveDashboardPage } from './pages/LiveDashboardPage'
import { SensorDetailsPage } from './pages/SensorDetailsPage'
import { ZoneDetailsPage } from './pages/ZoneDetailsPage'
import type { EventClassification, SeismicEvent } from './types/seismic'
import {
  evaluateAlertSeverity,
  isSeverityAtLeast,
  normalizeAlertPreferences,
  readAlertPreferences,
  saveAlertPreferences,
  shouldTriggerAlert,
  type AlertPreferences,
  type AlertSeverity,
} from './utils/alerting'
import { playAlertTone } from './utils/alertAudio'
import { TimezoneProvider } from './contexts/TimezoneContext'

const LIVE_SOCKET_URL = (import.meta.env.VITE_LIVE_WS_URL as string | undefined)?.trim()
const LIVE_HISTORY_URL = (import.meta.env.VITE_HISTORY_API_URL as string | undefined)?.trim()
const FRONTEND_VERSION = import.meta.env.VITE_FRONTEND_VERSION || '0.0.0'
const BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT || 'unknown'
const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP || new Date().toISOString()
const BACKEND_IMAGE_TAG = import.meta.env.VITE_BACKEND_IMAGE_TAG || 'untracked'
const DECRYPT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#?*'
const THEME_STORAGE_KEY = 'gsm-theme-preferences-v1'

type ThemeMode = 'dark' | 'light'
type ThemePattern = 'classic' | 'amber' | 'emerald'

interface ThemePreferences {
  mode: ThemeMode
  pattern: ThemePattern
}

interface AlertNotice {
  classification: EventClassification
  severity: AlertSeverity
  frequency: number
  triggeredAt: string
}

const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  mode: 'dark',
  pattern: 'classic',
}

const isThemeMode = (value: unknown): value is ThemeMode => value === 'dark' || value === 'light'
const isThemePattern = (value: unknown): value is ThemePattern => value === 'classic' || value === 'amber' || value === 'emerald'

const readStoredThemePreferences = (): ThemePreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_PREFERENCES
  }

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_THEME_PREFERENCES
    }

    const parsed = JSON.parse(raw) as Partial<ThemePreferences>
    return {
      mode: isThemeMode(parsed.mode) ? parsed.mode : DEFAULT_THEME_PREFERENCES.mode,
      pattern: isThemePattern(parsed.pattern) ? parsed.pattern : DEFAULT_THEME_PREFERENCES.pattern,
    }
  } catch {
    return DEFAULT_THEME_PREFERENCES
  }
}

const pageDecryptLabel = (pathname: string) => {
  if (pathname.startsWith('/history')) {
    return 'DECRYPTING ARCHIVE DOSSIER'
  }

  return 'OPENING LIVE TACTICAL FEED'
}

const scrambleLabel = (target: string, revealed: number) => {
  return target
    .split('')
    .map((char, index) => {
      if (char === ' ') {
        return ' '
      }

      if (index < revealed) {
        return char
      }

      return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)]
    })
    .join('')
}

const buildBaseDiagnostics = (): string[] => {
  const checks: string[] = []
  checks.push(LIVE_SOCKET_URL ? 'Live websocket configured: OK' : 'Live websocket missing: set VITE_LIVE_WS_URL')
  if (!LIVE_HISTORY_URL) {
    checks.push('History API missing: set VITE_HISTORY_API_URL')
  }
  return checks
}

const AppFrame = () => {
  const stream = useSeismicStream({
    socketUrl: LIVE_SOCKET_URL,
    historyBootstrapUrl: LIVE_HISTORY_URL,
    historyBootstrapLimit: 50,
  })
  const infrastructure = useInfrastructureStatus(LIVE_HISTORY_URL)
  const [diagnostics, setDiagnostics] = useState<string[]>(() => buildBaseDiagnostics())
  const [selectedEvent, setSelectedEvent] = useState<SeismicEvent | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [themePreferences, setThemePreferences] = useState<ThemePreferences>(() => readStoredThemePreferences())
  const [alertPreferences, setAlertPreferences] = useState<AlertPreferences>(() => readAlertPreferences())
  const [activeAlertSeverity, setActiveAlertSeverity] = useState<AlertSeverity | null>(null)
  const [alertNotice, setAlertNotice] = useState<AlertNotice | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [isRouteTransitioning, setIsRouteTransitioning] = useState(false)
  const [decryptLabel, setDecryptLabel] = useState(pageDecryptLabel(location.pathname))
  const lastProcessedEventIdRef = useRef<string | null>(null)
  const currentSeverityRef = useRef<AlertSeverity | null>(null)
  const lastTriggeredRef = useRef<Record<AlertSeverity, number | null>>({
    low: null,
    medium: null,
    high: null,
    critical: null,
  })
  const alertNoticeTimerRef = useRef<number | null>(null)

  const totalReplicas = infrastructure.status?.replicas.length ?? 0
  const healthyReplicas = infrastructure.status?.replicas.filter((item) => item.status === 'healthy').length ?? 0
  const downReplicas = infrastructure.status?.replicas.filter((item) => item.status === 'down') ?? []
  const allReplicasDown = totalReplicas > 0 && healthyReplicas === 0

  const infrastructureAlert = downReplicas.length > 0
    ? {
        tone: allReplicasDown ? 'critical' as const : 'warning' as const,
        message: allReplicasDown
          ? 'All replicas are down.'
          : `${downReplicas.length} replica(s) down: ${downReplicas.map((item) => item.id).join(', ')}`,
      }
    : null

  const openSensorPage = (sensorId: string) => {
    setSelectedEvent(null)
    navigate(`/sensors/${encodeURIComponent(sensorId)}`)
  }

  useEffect(() => {
    const checks: string[] = buildBaseDiagnostics()

    if (!LIVE_HISTORY_URL) {
      return
    }

    let active = true
    const runChecks = async () => {
      try {
        const healthUrl = new URL(LIVE_HISTORY_URL)
        healthUrl.pathname = '/health'
        healthUrl.search = ''

        const healthResponse = await fetch(healthUrl.toString())
        checks.push(healthResponse.ok ? 'Backend health endpoint: OK' : 'Backend health endpoint: FAILED')
      } catch {
        checks.push('Backend health endpoint: unreachable (run docker compose up)')
      }

      if (active) {
        setDiagnostics(checks)
      }
    }

    void runChecks()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.colorMode = themePreferences.mode
    document.documentElement.dataset.colorPattern = themePreferences.pattern
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themePreferences))
  }, [themePreferences])

  useEffect(() => {
    saveAlertPreferences(alertPreferences)
  }, [alertPreferences])

  useEffect(() => {
    const latestEvent = stream.events[0]
    if (!latestEvent) {
      return
    }

    if (latestEvent.event_id === lastProcessedEventIdRef.current) {
      return
    }

    lastProcessedEventIdRef.current = latestEvent.event_id
    const nowMs = Date.now()
    const nextSeverity = evaluateAlertSeverity(latestEvent.frequency, alertPreferences.thresholds)
    const previousSeverity = currentSeverityRef.current
    currentSeverityRef.current = nextSeverity
    setActiveAlertSeverity(nextSeverity)

    const shouldAlert = shouldTriggerAlert({
      previousSeverity,
      nextSeverity,
      lastTriggeredAtMs: nextSeverity ? lastTriggeredRef.current[nextSeverity] : null,
      nowMs,
      cooldownMs: alertPreferences.cooldownMs,
      reAlertOnStable: alertPreferences.reAlertOnStable,
    })

    if (!shouldAlert || !nextSeverity) {
      return
    }

    lastTriggeredRef.current[nextSeverity] = nowMs

    const shouldPlayAudio =
      alertPreferences.audioEnabled && isSeverityAtLeast(nextSeverity, alertPreferences.audioMinSeverity)
    const shouldShowVisual =
      alertPreferences.visualEnabled && isSeverityAtLeast(nextSeverity, alertPreferences.visualMinSeverity)

    if (shouldPlayAudio) {
      playAlertTone(nextSeverity, alertPreferences.audioVolume)
    }

    if (shouldShowVisual) {
      setAlertNotice({
        classification: latestEvent.classification,
        severity: nextSeverity,
        frequency: latestEvent.frequency,
        triggeredAt: latestEvent.timestamp,
      })

      if (alertNoticeTimerRef.current !== null) {
        window.clearTimeout(alertNoticeTimerRef.current)
      }

      alertNoticeTimerRef.current = window.setTimeout(() => {
        setAlertNotice(null)
        alertNoticeTimerRef.current = null
      }, alertPreferences.visualDurationMs)
    }
  }, [alertPreferences, stream.events])

  useEffect(() => {
    if (alertPreferences.visualEnabled) {
      return
    }

    setAlertNotice(null)
    if (alertNoticeTimerRef.current !== null) {
      window.clearTimeout(alertNoticeTimerRef.current)
      alertNoticeTimerRef.current = null
    }
  }, [alertPreferences.visualEnabled])

  useEffect(() => {
    return () => {
      if (alertNoticeTimerRef.current !== null) {
        window.clearTimeout(alertNoticeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const targetLabel = pageDecryptLabel(location.pathname)
    let reveal = 0

    const startTimer = window.setTimeout(() => {
      setIsRouteTransitioning(true)
    }, 0)

    const scrambleTimer = window.setInterval(() => {
      setDecryptLabel(scrambleLabel(targetLabel, reveal))
      reveal += 1

      if (reveal > targetLabel.length + 2) {
        window.clearInterval(scrambleTimer)
        setDecryptLabel(targetLabel)
      }
    }, 26)

    const hideTimer = window.setTimeout(() => {
      setIsRouteTransitioning(false)
      setDecryptLabel(targetLabel)
    }, 640)

    return () => {
      window.clearTimeout(startTimer)
      window.clearInterval(scrambleTimer)
      window.clearTimeout(hideTimer)
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1300px] flex-col gap-4 px-3 py-4 md:px-5 md:py-6">
        <div className="app-atmosphere absolute inset-0 -z-10 opacity-40" />

        <CommandHeader
          connectionState={stream.connectionState}
          onOpenAbout={() => setShowAbout(true)}
          themeMode={themePreferences.mode}
          themePattern={themePreferences.pattern}
          onChangeThemePattern={(pattern) => setThemePreferences((current) => ({ ...current, pattern }))}
          onToggleThemeMode={() =>
            setThemePreferences((current) => ({
              ...current,
              mode: current.mode === 'dark' ? 'light' : 'dark',
            }))
          }
          onResetTheme={() => setThemePreferences(DEFAULT_THEME_PREFERENCES)}
          activeAlertSeverity={activeAlertSeverity}
          alertPreferences={alertPreferences}
          onAlertPreferencesChange={(next) => setAlertPreferences(normalizeAlertPreferences(next))}
          infrastructureAlert={infrastructureAlert}
          eventAlert={alertPreferences.visualEnabled ? alertNotice : null}
        />

        <main className={isRouteTransitioning ? 'route-content route-content--transitioning' : 'route-content'}>
          <Routes>
            <Route path="/" element={<Navigate to="/live" replace />} />
            <Route
              path="/live"
              element={
                <LiveDashboardPage
                  sensors={stream.sensors}
                  events={stream.events}
                  infrastructure={infrastructure.status}
                  diagnostics={diagnostics}
                  missionMetrics={stream.missionMetrics}
                  onSelectEvent={setSelectedEvent}
                  onOpenSensor={openSensorPage}
                />
              }
            />
            <Route path="/history" element={<HistoryPage onSelectEvent={setSelectedEvent} />} />
            <Route path="/infrastructure" element={<InfrastructurePage historyApiUrl={LIVE_HISTORY_URL} disconnectHistory={stream.disconnectHistory} />} />
            <Route
              path="/sensors/:sensorId"
              element={
                <SensorDetailsPage
                  sensors={stream.sensors}
                  liveEvents={stream.events}
                  onSelectEvent={setSelectedEvent}
                />
              }
            />
            <Route
              path="/zones/:zoneId"
              element={
                <ZoneDetailsPage
                  sensors={stream.sensors}
                  liveEvents={stream.events}
                  onSelectEvent={setSelectedEvent}
                />
              }
            />
          </Routes>
        </main>

        {isRouteTransitioning ? (
          <div className="route-decrypt-overlay" aria-live="polite" aria-atomic="true">
            <span className="route-decrypt-label">{decryptLabel}</span>
          </div>
        ) : null}
      </div>

      <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      <ReconnectingOverlay
        active={stream.connectionState === 'reconnecting' || stream.connectionState === 'error'}
        attempts={stream.reconnectAttempt}
        faultType={stream.currentFaultType}
        disconnectHistory={stream.disconnectHistory}
        lastError={stream.lastError}
        onRetry={stream.forceReconnect}
      />
      <AboutModal
        open={showAbout}
        onClose={() => setShowAbout(false)}
        frontendVersion={FRONTEND_VERSION}
        commitHash={BUILD_COMMIT}
        backendImageTag={BACKEND_IMAGE_TAG}
        buildTimestamp={BUILD_TIMESTAMP}
      />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <TimezoneProvider>
        <AppFrame />
      </TimezoneProvider>
    </BrowserRouter>
  )
}

export default App
