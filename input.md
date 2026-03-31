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

- id: unique string (MD5 hash of sensor_id + timestamp)
- source: string (sensor_id, e.g., sensor-123)
- type: string (EARTHQUAKE, CONVENTIONAL_EXPLOSION, NUCLEAR_EVENT)
- timestamp: ISO8601 UTC
- location:
  - lat: number
  - lon: number
- frequency: float (dominant frequency from FFT analysis)
- classification: string (same as type: EARTHQUAKE, CONVENTIONAL_EXPLOSION, NUCLEAR_EVENT)
- confirmed: boolean (true if consensus reached)
- sensorId: string (same as source)
- region: string

Example JSON:

```json
{
  "id": "a1b2c3d4e5f6...",
  "source": "sensor-42",
  "type": "EARTHQUAKE",
  "timestamp": "2026-03-30T12:34:56.123Z",
  "location": {"lat": 46.12, "lon": 11.35},
  "frequency": 2.5,
  "classification": "EARTHQUAKE",
  "confirmed": true,
  "sensorId": "sensor-42",
  "region": "Alps"
}
```

## Rule model

Classification is based on fixed frequency thresholds in the analyzer (0.5-3.0 Hz: EARTHQUAKE, 3.0-8.0 Hz: CONVENTIONAL_EXPLOSION, >=8.0 Hz: NUCLEAR_EVENT).

### How to use them

- In ingest: validate the incoming event schema and reject/log errors for missing required fields.
- In processing: apply the rule model to each event (single) and to aggregates (windowed) to generate alerts.
- In storage: save normalized events according to the schema; record triggered rules.
- In UI: map API/properties from the model to display badges, filters, and notifications.
