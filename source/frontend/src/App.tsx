import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AboutModal } from './components/common/AboutModal'
import { EventDetailsModal } from './components/common/EventDetailsModal'
import { ReconnectingOverlay } from './components/common/ReconnectingOverlay'
import { CommandHeader } from './components/header/CommandHeader'
import { useInfrastructureStatus } from './hooks/useInfrastructureStatus'
import { useSeismicStream } from './hooks/useSeismicStream'
import { HistoryPage } from './pages/HistoryPage'
import { LiveDashboardPage } from './pages/LiveDashboardPage'
import { SensorDetailsPage } from './pages/SensorDetailsPage'
import { ZoneDetailsPage } from './pages/ZoneDetailsPage'
import type { SeismicEvent } from './types/seismic'

const LIVE_SOCKET_URL = (import.meta.env.VITE_LIVE_WS_URL as string | undefined)?.trim()
const LIVE_HISTORY_URL = (import.meta.env.VITE_HISTORY_API_URL as string | undefined)?.trim()
const FRONTEND_VERSION = import.meta.env.VITE_FRONTEND_VERSION || '0.0.0'
const BUILD_COMMIT = import.meta.env.VITE_BUILD_COMMIT || 'unknown'
const BUILD_TIMESTAMP = import.meta.env.VITE_BUILD_TIMESTAMP || new Date().toISOString()
const BACKEND_IMAGE_TAG = import.meta.env.VITE_BACKEND_IMAGE_TAG || 'untracked'
const DECRYPT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#?*'

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
  const location = useLocation()
  const navigate = useNavigate()
  const [isRouteTransitioning, setIsRouteTransitioning] = useState(false)
  const [decryptLabel, setDecryptLabel] = useState(pageDecryptLabel(location.pathname))

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

      try {
        const streamUrl = new URL(LIVE_HISTORY_URL)
        streamUrl.pathname = '/api/mock/stream'
        streamUrl.search = ''

        const simulatorResponse = await fetch(streamUrl.toString())
        checks.push(simulatorResponse.ok ? 'Simulator control endpoint: OK' : 'Simulator control endpoint: unavailable')
      } catch {
        checks.push('Simulator control endpoint: unreachable')
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
        <div className="absolute inset-0 -z-10 opacity-40 [background:radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(190,24,93,0.15),transparent_35%),linear-gradient(#0a0a0a,#0a0a0a)]" />

        <CommandHeader
          connectionState={stream.connectionState}
          onOpenAbout={() => setShowAbout(true)}
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
      <AppFrame />
    </BrowserRouter>
  )
}

export default App
