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
    <section className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-7 xl:col-span-8">
        <SensorGridMap sensors={sensors} latestEvents={events} onSelectEvent={onSelectEvent} />
      </div>
      <div className="lg:col-span-5 xl:col-span-4">
        <LiveEventFeed events={events} onSelectEvent={onSelectEvent} />
      </div>
    </section>
  )
}
