import type { SeismicEvent, SensorMeta } from '../types/seismic'
import { SensorGridMap } from '../components/live/SensorGridMap'
import { LiveEventFeed } from '../components/live/LiveEventFeed'

interface LiveDashboardPageProps {
  sensors: SensorMeta[]
  events: SeismicEvent[]
  onSelectEvent: (event: SeismicEvent) => void
  onOpenSensor: (sensorId: string) => void
}

export const LiveDashboardPage = ({ sensors, events, onSelectEvent, onOpenSensor }: LiveDashboardPageProps) => {
  return (
    <section className="space-y-4">
      <SensorGridMap sensors={sensors} latestEvents={events} onSelectSensor={onOpenSensor} />
      <LiveEventFeed events={events} onSelectEvent={onSelectEvent} />
    </section>
  )
}
