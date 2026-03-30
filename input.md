# SYSTEM DESCRIPTION:

"A Fragile Balance of Power" is a distributed, fault-tolerant seismic monitoring platform designed to ingest, analyze, and classify real-time seismic data. The system's primary objective is to monitor a global grid of sensors to detect and categorize seismic activity into Earthquakes, Conventional Explosions, and Nuclear Events, thereby ensuring regional and global security.

# USER STORIES:

1. As an Operator, I want to see a real-time map of all sensors with their latest readings so I can quickly identify which regions are showing activity.

2. As an Operator, I want to see a chronological feed of incoming seismic events with classification badges so I can stay aware of ongoing detections.

3. As an Operator, I want to see how many replicas are healthy/degraded/unavailable so I can assess system reliability at a glance.

4. As an Operator, I want to see session uptime, reconnect count, and estimated lost events so I can track system stability over time.

5. As an Operator, I want to click on a sensor to see its recent events and status so I can investigate specific locations.

6. As an Operator, I want to pause the live event feed to analyze a particular event cluster without new events scrolling past.

7. As an Operator, I want to set custom frequency thresholds that trigger visual/audio alerts so I can focus on high-priority detections.

8. As an Operator, I want events color-coded by severity (NUCLEAR in red, EXPLOSION in orange, EARTHQUAKE in yellow) so incident criticality is instantly visible.

9. As a Data Analyst, I want to filter history by event type (EARTHQUAKE/EXPLOSION/NUCLEAR) so I can analyze specific seismic phenomena.

10. As a Data Analyst, I want to narrow results by sensor ID or geographic region so I can study localized activity patterns.

11. As a Data Analyst, I want to select custom date/time ranges and use preset shortcuts (Last Hour, Today, Last Week) so I can quickly review specific time windows.

12. As a Data Analyst, I want to download filtered results as CSV so I can perform advanced statistical analysis in external tools.

13. As a Data Analyst, I want to see events plotted on a timeline so I can identify temporal clustering and event sequences.

14. As a Data Analyst, I want to group closely-timed events into "incidents" so I can analyze coordinated or cascading seismic activity.

15. As a Data Analyst, I want to see which events were confirmed by majority vote across replicas so I can assess detection consensus quality.

16. As a Data Analyst, I want to see frequency distribution charts (e.g., how many EARTHQUAKEs per region) so I can identify spatial-temporal patterns.

17. As a Data Analyst, I want to compare event counts and frequency profiles across two sensors side-by-side so I can identify sensor anomalies or regional differences.

18. As a System Administrator, I want to see which replicas are healthy and which are down so I can quickly identify infrastructure failures.

19. As a System Administrator, I want to track total session uptime so I can report SLA compliance.

20. As a System Administrator, I want to see how many reconnect events have occurred so I can detect flaky connections.

21. As a System Administrator, I want to know approximate lost events count so I can assess data integrity.

22. As a System Administrator, I want to verify backend connectivity status so I can validate deployment health during startup.

23. As a System Administrator, I want to receive visual alerts when a replica goes down or enters degraded state so I can respond quickly to failures.

24. As a System Administrator, I want to download system metrics (uptime, reconnects, CPU/memory if available) so I can feed them into monitoring dashboards.

25. As a System Administrator,  I want the health status to be continuously updated via WebSocket so I can monitor fixes in real time.

# EVENT MODEL AND RULE MODEL

## Standard event schema

In this system context, the standard event schema defines the common format for all events flowing through the pipeline (ingest, broker, replica, UI).

- id: unique string
- source: string (e.g., sensor-123, simulator)
- type: string (EARTHQUAKE, EXPLOSION, NUCLEAR, HEARTBEAT, DISCONNECTION, etc.)
- severity: int (1..10 or string levels: LOW, MEDIUM, HIGH)
- timestamp: ISO8601 UTC
- location:
  - lat: number
  - lon: number
  - depth: number (km, optional)
- magnitude: float (e.g., event magnitude, optional)
- classification: string (Earthquake, ConventionalExplosion, Nuclear)
- confidence: float 0..1
- metadata: free-form object (e.g., sensor firmware, version, replicaId)

Example JSON:

```json
{
  "id": "evt-0001",
  "source": "sensor-42",
  "type": "EARTHQUAKE",
  "severity": "HIGH",
  "timestamp": "2026-03-30T12:34:56.123Z",
  "location": {"lat": 46.12, "lon": 11.35, "depth": 12.8},
  "magnitude": 5.8,
  "classification": "Earthquake",
  "confidence": 0.94,
  "metadata": {"sensorModel": "GL-1", "region": "Alps"}
}
```

## Rule model

The rule model defines detection/alert rules applied to the data stream to trigger actions (UI alerts, notifications, escalation). Each rule is an object with:

- id: unique string
- name: descriptive string
- description: optional string
- trigger: boolean condition (e.g., `type == 'NUCLEAR' && confidence >= 0.8`)
- thresholds: structured field objects (e.g., magnitude, severity, event count)
- window: time duration (e.g., 1m, 5m, 1h) for aggregation
- actions: array (broadcast-alert, store-event, notify-operator, ack)
- enabled: boolean

Example JSON:

```json
{
  "id": "rule-01",
  "name": "Nuclear risk high",
  "description": "Alert when a NUCLEAR event appears with high confidence",
  "trigger": "event.type == 'NUCLEAR' && event.confidence >= 0.8",
  "thresholds": {"confidence": 0.8, "severity": "HIGH"},
  "window": "1m",
  "actions": ["notify-ops", "log-event", "flash-ui"],
  "enabled": true
}
```

### How to use them

- In ingest: validate the incoming event schema and reject/log errors for missing required fields.
- In processing: apply the rule model to each event (single) and to aggregates (windowed) to generate alerts.
- In storage: save normalized events according to the schema; record triggered rules.
- In UI: map API/properties from the model to display badges, filters, and notifications.
