import type { SeismicEvent, SensorMeta } from '../types/seismic'
import { SensorGridMap } from '../components/live/SensorGridMap'
import { LiveEventFeed } from '../components/live/LiveEventFeed'

interface LiveDashboardPageProps {
  sensors: SensorMeta[]
  events: SeismicEvent[]
  onSelectEvent: (event: SeismicEvent) => void
}

export const LiveDashboardPage = ({ sensors, events, onSelectEvent }: LiveDashboardPageProps) => {
  return (
    <section className="space-y-4">
      <SensorGridMap sensors={sensors} latestEvents={events} onSelectEvent={onSelectEvent} />
      <LiveEventFeed events={events} onSelectEvent={onSelectEvent} />
    </section>
  )
}
