import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { EventDetailsModal } from './components/common/EventDetailsModal'
import { CommandHeader } from './components/header/CommandHeader'
import { useSeismicStream } from './hooks/useSeismicStream'
import { HistoryPage } from './pages/HistoryPage'
import { LiveDashboardPage } from './pages/LiveDashboardPage'
import { SensorDetailsPage } from './pages/SensorDetailsPage'
import type { SeismicEvent } from './types/seismic'

const LIVE_SOCKET_URL = (import.meta.env.VITE_LIVE_WS_URL as string | undefined)?.trim()
const LIVE_HISTORY_URL = (import.meta.env.VITE_HISTORY_API_URL as string | undefined)?.trim()
const MISSING_LIVE_URL_MESSAGE = 'Realtime backend URL missing: set VITE_LIVE_WS_URL in .env'
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

const AppFrame = () => {
  const stream = useSeismicStream({
    socketUrl: LIVE_SOCKET_URL,
    historyBootstrapUrl: LIVE_HISTORY_URL,
    historyBootstrapLimit: 50,
  })
  const liveUrlMissing = !LIVE_SOCKET_URL
  const [selectedEvent, setSelectedEvent] = useState<SeismicEvent | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [isRouteTransitioning, setIsRouteTransitioning] = useState(false)
  const [decryptLabel, setDecryptLabel] = useState(pageDecryptLabel(location.pathname))

  const openSensorPage = (sensorId: string) => {
    setSelectedEvent(null)
    navigate(`/sensors/${encodeURIComponent(sensorId)}`)
  }

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
          liveConfigWarning={liveUrlMissing ? MISSING_LIVE_URL_MESSAGE : undefined}
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
          </Routes>
        </main>

        {isRouteTransitioning ? (
          <div className="route-decrypt-overlay" aria-live="polite" aria-atomic="true">
            <span className="route-decrypt-label">{decryptLabel}</span>
          </div>
        ) : null}
      </div>

      <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
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
