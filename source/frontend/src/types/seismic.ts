export type EventClassification =
  | 'EARTHQUAKE'
  | 'CONVENTIONAL_EXPLOSION'
  | 'NUCLEAR_LIKE'

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

export interface SensorMeta {
  sensor_id: string
  lat: number
  long: number
  region: string
}

export interface SeismicEvent {
  event_id: string
  sensor_id: string
  timestamp: string
  startsAt?: string
  endsAt?: string
  durationSeconds?: number
  frequency: number
  classification: EventClassification
  severity?: 'normal' | 'warning' | 'critical'
  amplitude?: number
  sensor?: SensorMeta
}

export interface HistoryFilters {
  type: EventClassification | 'ALL'
  sensorId: string
  region: string
}

export type FilterRuleCategory = 'type' | 'sensor' | 'region'
export type FilterRuleMode = 'include' | 'exclude'

export interface HistoryFilterRule {
  category: FilterRuleCategory
  value: string
  mode: FilterRuleMode
}

export type HistoryTimePreset = '1h' | '6h' | '24h' | '7d' | null

export interface HistoryTimeFilter {
  fromUtc: string
  toUtc: string
  preset: HistoryTimePreset
}

export interface HistoryQuery {
  type?: EventClassification
  sensor_id?: string
  region?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface HistoryQueryOptions {
  limit?: number
  offset?: number
  from?: string
  to?: string
}

export interface HistoryPageResult {
  events: SeismicEvent[]
  total: number
  limit: number
  offset: number
  pagingMode: 'server' | 'client-fallback'
}

export interface InfrastructureReplica {
  id: string
  status: 'healthy' | 'down'
  lagMs: number
}

export interface InfrastructureStatus {
  gateway: 'healthy' | 'degraded' | 'down'
  replicas: InfrastructureReplica[]
  activeReplica: string | null
  lastFailoverAt: string | null
}

export type FaultType = 'network' | 'gateway' | 'replica' | 'configuration' | 'unknown'

export interface DisconnectEvent {
  startedAt: string
  endedAt: string
  durationMs: number
  faultType: FaultType
}

export interface MissionMetrics {
  sessionStartedAt: string
  uptimeMs: number
  reconnectCount: number
  maxDisconnectMs: number
  estimatedLostEvents: number
}

export interface StreamSnapshot {
  connectionState: ConnectionState
  reconnectAttempt: number
  events: SeismicEvent[]
  sensors: SensorMeta[]
  lastError?: string
  disconnectHistory: DisconnectEvent[]
  missionMetrics: MissionMetrics
  currentFaultType: FaultType
}
