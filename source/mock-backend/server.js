import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT || 8090)
const MAX_HISTORY = 1000
const MIN_INTERVAL_MS = 200
const MAX_INTERVAL_MS = 60000

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json())
app.use('/mock-ui', express.static(join(__dirname, 'public')))

const SENSOR_POOL = [
  { sensor_id: 'S-01', lat: 45.46, long: 9.19, region: 'NORTH CORRIDOR' },
  { sensor_id: 'S-02', lat: 41.9, long: 12.49, region: 'CENTRAL COMMAND BELT' },
  { sensor_id: 'S-03', lat: 40.85, long: 14.27, region: 'SOUTH BASIN' },
  { sensor_id: 'S-04', lat: 37.5, long: 15.08, region: 'IONIAN EDGE' },
  { sensor_id: 'S-05', lat: 48.85, long: 2.35, region: 'WEST FRONT' },
  { sensor_id: 'S-06', lat: 52.52, long: 13.4, region: 'EAST BELT' },
  { sensor_id: 'S-07', lat: 59.33, long: 18.07, region: 'NORDIC WATCH' },
  { sensor_id: 'S-08', lat: 35.68, long: 139.69, region: 'PACIFIC OUTPOST' }
]

const PRESET_DEFINITIONS = {
  demo_escalation: {
    label: 'Escalation (EQ -> EXP -> NUC)',
    description: 'Escalating sequence on one sensor to verify classification transitions.',
    sequence: [
      { delayMs: 0, sensor_id: 'S-03', frequency: 1.2, amplitude: 2.1 },
      { delayMs: 1200, sensor_id: 'S-03', frequency: 2.4, amplitude: 3.5 },
      { delayMs: 2400, sensor_id: 'S-03', frequency: 4.8, amplitude: 6.2 },
      { delayMs: 3600, sensor_id: 'S-03', frequency: 7.3, amplitude: 8.7 },
      { delayMs: 4800, sensor_id: 'S-03', frequency: 9.6, amplitude: 11.4 }
    ]
  },
  burst_north_corridor: {
    label: 'North Corridor Burst',
    description: 'High-frequency cluster on north/west sensors to stress timeline and map.',
    sequence: [
      { delayMs: 0, sensor_id: 'S-01', frequency: 5.1, amplitude: 7.1 },
      { delayMs: 500, sensor_id: 'S-01', frequency: 6.2, amplitude: 8.2 },
      { delayMs: 1000, sensor_id: 'S-05', frequency: 4.7, amplitude: 7.6 },
      { delayMs: 1500, sensor_id: 'S-01', frequency: 8.8, amplitude: 10.1 },
      { delayMs: 2000, sensor_id: 'S-05', frequency: 9.2, amplitude: 10.8 },
      { delayMs: 2500, sensor_id: 'S-01', frequency: 3.5, amplitude: 5.5 }
    ]
  },
  distributed_wave: {
    label: 'Distributed Wave',
    description: 'Wave traveling across multiple sensors for global map demonstration.',
    sequence: [
      { delayMs: 0, sensor_id: 'S-08', frequency: 2.0, amplitude: 3.0 },
      { delayMs: 900, sensor_id: 'S-07', frequency: 2.5, amplitude: 3.4 },
      { delayMs: 1800, sensor_id: 'S-06', frequency: 3.3, amplitude: 4.7 },
      { delayMs: 2700, sensor_id: 'S-02', frequency: 4.2, amplitude: 5.9 },
      { delayMs: 3600, sensor_id: 'S-04', frequency: 5.0, amplitude: 6.5 },
      { delayMs: 4500, sensor_id: 'S-03', frequency: 3.1, amplitude: 4.4 }
    ]
  }
}

const historyEvents = []
let autoStreamEnabled = true
let autoStreamIntervalMs = 1000
let autoStreamTimer = null
const activePresetTimers = new Set()

const classifyByFrequency = (frequency) => {
  if (frequency >= 0.5 && frequency < 3.0) {
    return 'EARTHQUAKE'
  }
  if (frequency >= 3.0 && frequency < 8.0) {
    return 'CONVENTIONAL_EXPLOSION'
  }
  return 'NUCLEAR_LIKE'
}

const randomFrequency = () => {
  const roll = Math.random()
  if (roll < 0.65) {
    return Number((0.5 + Math.random() * 2.4).toFixed(2))
  }
  if (roll < 0.93) {
    return Number((3.0 + Math.random() * 4.7).toFixed(2))
  }
  return Number((8.0 + Math.random() * 4.0).toFixed(2))
}

const createEventFromPayload = (body = {}) => {
  const selectedSensor = SENSOR_POOL.find((sensor) => sensor.sensor_id === body.sensor_id)
  const sensor = selectedSensor ?? SENSOR_POOL[Math.floor(Math.random() * SENSOR_POOL.length)]

  const incomingFrequency = Number(body.frequency)
  const frequency = Number.isFinite(incomingFrequency) ? Number(incomingFrequency.toFixed(2)) : randomFrequency()

  const incomingAmplitude = Number(body.amplitude)
  const amplitude = Number.isFinite(incomingAmplitude)
    ? Number(incomingAmplitude.toFixed(2))
    : Number((Math.random() * 12).toFixed(2))

  return {
    event_id: randomUUID(),
    sensor_id: sensor.sensor_id,
    timestamp: body.timestamp && !Number.isNaN(Date.parse(String(body.timestamp)))
      ? new Date(String(body.timestamp)).toISOString()
      : new Date().toISOString(),
    frequency,
    amplitude,
    lat: sensor.lat,
    long: sensor.long,
    region: sensor.region,
    classification: classifyByFrequency(frequency)
  }
}

const appendToHistory = (event) => {
  historyEvents.unshift(event)
  if (historyEvents.length > MAX_HISTORY) {
    historyEvents.length = MAX_HISTORY
  }
}

const generateEvent = () => {
  const event = createEventFromPayload()
  appendToHistory(event)
  return event
}

const ensureRecentHistory = (targetCount) => {
  while (historyEvents.length < targetCount) {
    generateEvent()
  }
}

const toFrontendEvent = (event) => ({
  event_id: event.event_id,
  sensor_id: event.sensor_id,
  timestamp: event.timestamp,
  frequency: event.frequency,
  classification: event.classification,
  amplitude: event.amplitude,
  lat: event.lat,
  long: event.long,
  region: event.region
})

const toHistoryEvent = (event) => ({
  event_id: event.event_id,
  sensor_id: event.sensor_id,
  timestamp: event.timestamp,
  frequency: event.frequency,
  classification: event.classification,
  amplitude: event.amplitude,
  sensor: {
    sensor_id: event.sensor_id,
    lat: event.lat,
    long: event.long,
    region: event.region
  }
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/api/events/ws' })

const broadcastEvent = (event) => {
  const payload = JSON.stringify(toFrontendEvent(event))
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(payload)
    }
  }
}

const createAndBroadcastManualEvent = (body = {}) => {
  const event = createEventFromPayload(body)
  appendToHistory(event)
  broadcastEvent(event)
  return event
}

const scheduleAutoStream = () => {
  if (autoStreamTimer) {
    clearInterval(autoStreamTimer)
    autoStreamTimer = null
  }

  autoStreamTimer = setInterval(() => {
    if (!autoStreamEnabled) {
      return
    }

    const event = generateEvent()
    broadcastEvent(event)
  }, autoStreamIntervalMs)
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mock-seismic-backend', port: PORT })
})

app.get('/api/sensors', (_req, res) => {
  res.json(SENSOR_POOL)
})

app.get('/api/history/events', (req, res) => {
  const { type, sensor_id, region, limit } = req.query

  const result = historyEvents.filter((event) => {
    const typeOk = !type || event.classification === String(type)
    const sensorOk = !sensor_id || event.sensor_id.toLowerCase().includes(String(sensor_id).toLowerCase())
    const regionOk = !region || event.region.toLowerCase().includes(String(region).toLowerCase())
    return typeOk && sensorOk && regionOk
  })

  const parsedLimit = Number(limit)
  const boundedResult = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? result.slice(0, Math.min(200, Math.round(parsedLimit)))
    : result

  res.json(boundedResult.map((event) => toHistoryEvent(event)))
})

app.get('/api/mock/stream', (_req, res) => {
  res.json({
    enabled: autoStreamEnabled,
    intervalMs: autoStreamIntervalMs,
    activePresetJobs: activePresetTimers.size
  })
})

app.post('/api/mock/stream', (req, res) => {
  const nextEnabled = typeof req.body?.enabled === 'boolean' ? req.body.enabled : autoStreamEnabled
  const parsedInterval = Number(req.body?.intervalMs)

  if (Number.isFinite(parsedInterval)) {
    if (parsedInterval < MIN_INTERVAL_MS || parsedInterval > MAX_INTERVAL_MS) {
      res.status(400).json({
        error: 'INVALID_INTERVAL',
        message: `intervalMs must be between ${MIN_INTERVAL_MS} and ${MAX_INTERVAL_MS}`
      })
      return
    }

    autoStreamIntervalMs = Math.round(parsedInterval)
  }

  autoStreamEnabled = nextEnabled
  scheduleAutoStream()

  res.json({
    updated: true,
    enabled: autoStreamEnabled,
    intervalMs: autoStreamIntervalMs
  })
})

app.get('/api/mock/presets', (_req, res) => {
  const presets = Object.entries(PRESET_DEFINITIONS).map(([name, preset]) => ({
    name,
    label: preset.label,
    description: preset.description,
    events: preset.sequence.length
  }))
  res.json(presets)
})

app.post('/api/mock/event', (req, res) => {
  const event = createAndBroadcastManualEvent(req.body ?? {})
  res.status(201).json({ created: true, event: toHistoryEvent(event) })
})

app.post('/api/mock/preset', (req, res) => {
  const presetName = String(req.body?.name || '')
  const preset = PRESET_DEFINITIONS[presetName]

  if (!preset) {
    res.status(400).json({ error: 'UNKNOWN_PRESET', message: 'Preset not found.' })
    return
  }

  for (const step of preset.sequence) {
    const timer = setTimeout(() => {
      activePresetTimers.delete(timer)
      createAndBroadcastManualEvent(step)
    }, step.delayMs)

    activePresetTimers.add(timer)
  }

  res.status(202).json({
    started: true,
    preset: presetName,
    scheduledEvents: preset.sequence.length
  })
})

app.post('/api/mock/preset/stop', (_req, res) => {
  for (const timer of activePresetTimers) {
    clearTimeout(timer)
  }
  activePresetTimers.clear()

  res.json({ stopped: true })
})

wss.on('connection', (socket) => {
  ensureRecentHistory(50)

  const initialBatch = [...historyEvents]
    .slice(0, 50)
    .reverse()

  for (const event of initialBatch) {
    socket.send(JSON.stringify(toFrontendEvent(event)))
  }
})

scheduleAutoStream()

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-backend] listening on http://localhost:${PORT}`)
  // eslint-disable-next-line no-console
  console.log('[mock-backend] ws endpoint: ws://localhost:' + PORT + '/api/events/ws')
  // eslint-disable-next-line no-console
  console.log('[mock-backend] control UI: http://localhost:' + PORT + '/mock-ui/control.html')
})
