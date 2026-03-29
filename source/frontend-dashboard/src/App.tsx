import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CommandHeader } from './components/header/CommandHeader'
import { EventDetailsModal } from './components/common/EventDetailsModal'
import { useSeismicStream } from './hooks/useSeismicStream'
import { HistoryPage } from './pages/HistoryPage'
import { LiveDashboardPage } from './pages/LiveDashboardPage'
import type { SeismicEvent } from './types/seismic'

const LIVE_SOCKET_URL = (import.meta.env.VITE_LIVE_WS_URL as string | undefined)?.trim()
const LIVE_HISTORY_URL = (import.meta.env.VITE_HISTORY_API_URL as string | undefined)?.trim()
const MISSING_LIVE_URL_MESSAGE = 'Realtime backend URL missing: set VITE_LIVE_WS_URL in .env'

function App() {
  const stream = useSeismicStream({
    socketUrl: LIVE_SOCKET_URL,
    historyBootstrapUrl: LIVE_HISTORY_URL,
    historyBootstrapLimit: 50,
  })
  const liveUrlMissing = !LIVE_SOCKET_URL
  const [selectedEvent, setSelectedEvent] = useState<SeismicEvent | null>(null)

  useEffect(() => {
    const onPointerMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 100
      const y = (event.clientY / window.innerHeight) * 100
      document.body.style.setProperty('--mouse-x', `${x}%`)
      document.body.style.setProperty('--mouse-y', `${y}%`)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen text-zinc-100">
        <div className="relative mx-auto flex min-h-screen w-full max-w-[1360px] flex-col gap-6 px-4 py-5 md:px-6 md:py-8">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-85 [background:radial-gradient(circle_at_12%_8%,rgba(30,230,255,0.2),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(96,165,250,0.18),transparent_30%),radial-gradient(circle_at_50%_120%,rgba(45,212,191,0.08),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-35 [background:linear-gradient(120deg,rgba(255,255,255,0.12),transparent_28%,transparent_72%,rgba(255,255,255,0.08))] [background-size:200%_200%] [animation:gradientDrift_16s_ease-in-out_infinite]" />

          <CommandHeader
            connectionState={stream.connectionState}
            liveConfigWarning={liveUrlMissing ? MISSING_LIVE_URL_MESSAGE : undefined}
          />

          <main className="flex-1 module-reveal">
            <Routes>
              <Route path="/" element={<Navigate to="/live" replace />} />
              <Route
                path="/live"
                element={
                  <LiveDashboardPage
                    sensors={stream.sensors}
                    events={stream.events}
                    onSelectEvent={setSelectedEvent}
                  />
                }
              />
              <Route path="/history" element={<HistoryPage onSelectEvent={setSelectedEvent} />} />
            </Routes>
          </main>
        </div>

        <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      </div>
    </BrowserRouter>
  )
}

export default App
