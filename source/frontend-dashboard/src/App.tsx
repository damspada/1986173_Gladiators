import { useState } from 'react'
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

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="relative mx-auto flex min-h-screen w-full max-w-[1300px] flex-col gap-4 px-3 py-4 md:px-5 md:py-6">
          <div className="absolute inset-0 -z-10 opacity-40 [background:radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(190,24,93,0.15),transparent_35%),linear-gradient(#0a0a0a,#0a0a0a)]" />

          <CommandHeader
            connectionState={stream.connectionState}
            liveConfigWarning={liveUrlMissing ? MISSING_LIVE_URL_MESSAGE : undefined}
          />

          <main className="flex-1">
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
