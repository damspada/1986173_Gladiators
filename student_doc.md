# SYSTEM DESCRIPTION:

"A Fragile Balance of Power" is a distributed, fault-tolerant seismic monitoring platform designed to ingest, analyze, and classify real-time seismic data. The system monitors a global grid of sensors to detect and categorize seismic activity into Earthquakes, Conventional Explosions, and Nuclear Events. It provides replicated processing, consensus-based confirmation, and real-time dashboarding for operation and analysis.

# USER STORIES:

1. As an Operator, I want to see a real-time map of all sensors with their latest readings so I can quickly identify which regions are showing activity.

2. As an Operator, I want to see a chronological feed of incoming seismic events with classification badges so I can stay aware of ongoing detections.

3. As an Operator, I want to see how many replicas are healthy/degraded/unavailable so I can assess system reliability at a glance.

4. As an Operator, I want to change the theme’s page and choose between Night or
Light mode.

5. As an Operator, I want to click on a sensor to see its recent events and status so I can investigate specific locations.

6. As an Operator, I want to pause the live event feed to analyze a particular event cluster without new events scrolling past.

7. As an Operator, I want to set custom frequency thresholds that trigger visual/audio alerts so I can focus on high-priority detections.

8. As an Operator, I want events color-coded by severity (NUCLEAR in red, EXPLOSION in orange, EARTHQUAKE in yellow) so incident criticality is instantly visible.

9. As an Operator, i want to pause the Map’s auto-movement when events incomes.

10. As a Data Analyst, I want to filter history by event type (EARTHQUAKE/EXPLOSION/NUCLEAR) so I can analyze specific seismic phenomena.

11. As a Data Analyst, I want to narrow results by sensor ID or geographic region so I can study localized activity patterns.

12. As a Data Analyst, I want to select custom date/time ranges and use preset shortcuts (Last Hour, Today, Last Week) so I can quickly review specific time windows.

13. As a Data Analyst, I want to download filtered results as CSV/JSON so I can perform advanced statistical analysis in external tools.

14. As a Data Analyst, I want to see events plotted on a timeline so I can identify temporal clustering and event sequences.

15. As a Data Analyst, I want to group closely-timed events into "incidents" so I can analyze coordinated or cascading seismic activity.

16. As a Data Analyst, I want to see which events were confirmed by majority vote across replicas so I can assess detection consensus quality.

17. As a Data Analyst, I want to see the events timeline given a specific region so I can identify spatial-temporal patterns.

18. As a Data Analyst, I want to compare event counts and frequency profiles across two sensors side-by-side so I can identify sensor anomalies or regional differences.

19. As a System Administrator, I want to see which replicas are healthy and which are down so I can quickly identify infrastructure failures.

20. As a System Administrator, I want to download system metrics (uptime, reconnects, CPU/memory if available) so I can feed them into monitoring dashboards.

21. As a System Administrator, I want to see how many reconnect events have occurred so I can detect flaky connections.

22. As a System Administrator, I want to verify backend connectivity status so I can validate deployment health during startup.

23. As a System Administrator, I want to receive visual alerts when a replica goes down or enters degraded state so I can respond quickly to failures.

24. As a System Administrator, I want to see the application’s version and many other informations.

25. As a System Administrator,  I want the health status to be continuously updated via WebSocket so I can monitor fixes in real time.

# CONTAINERS:

## CONTAINER_NAME: Sensor-Broker

### DESCRIPTION: 
Manages sensor ingestion and internal event bus. It receives sensor telemetry, validates event schema, and forwards events to processing and storage components.

### USER STORIES:
1. As an Operator, I want to see a real-time map of all sensors with their latest readings so I can quickly identify which regions are showing activity.
2. As an Operator, I want to see a chronological feed of incoming seismic events with classification badges so I can stay aware of ongoing detections.
5. As an Operator, I want to click on a sensor to see its recent events and status so I can investigate specific locations.
7. As an Operator, I want to set custom frequency thresholds that trigger visual/audio alerts so I can focus on high-priority detections.
25. As a System Administrator,  I want the health status to be continuously updated via WebSocket so I can monitor fixes in real time.

### PORTS: 
9090:9090

### DESCRIPTION:
The Sensor-Broker container is responsible for ingesting sensor data from the simulator, validating incoming events against the standard event schema, and distributing them via Server-Sent Events (SSE) to connected replicas. It also maintains WebSocket connections for backend status updates on replica health.

### PERSISTANCE EVALUATION
The Sensor-Broker container does not require data persistence to manage event routing and streaming.

### EXTERNAL SERVICES CONNECTIONS
The Sensor-Broker container connects to the Simulator container for sensor discovery and telemetry ingestion.

### MICROSERVICES:

#### MICROSERVICE: broker
- TYPE: backend
- DESCRIPTION: Handles sensor data ingestion, event validation, SSE broadcasting to replicas, and WebSocket status updates for backend.
- PORTS: 9090
- TECHNOLOGICAL SPECIFICATION:
The microservice is developed in Go. It uses the standard library for HTTP server, SSE, and WebSocket handling. No external dependencies beyond Go standard library for core functionality.
- SERVICE ARCHITECTURE: 
The service uses goroutines for concurrent sensor reading and event broadcasting. It maintains hubs for replica connections and backend notifications.
- ENDPOINTS:
		
	| HTTP METHOD | URL | Description | User Stories |
	| ----------- | --- | ----------- | ------------ |
    | GET | /stream | SSE endpoint for replicas to receive events | 1, 2, 5, 7 |
    | GET | /backend/ws | WebSocket for backend to receive replica status | 3, 19-23, 25 |

## CONTAINER_NAME: Processing-Replica

### DESCRIPTION: 
Processes events to classify type, apply rules and produce consensus output. It also records replica health and uptime.

### USER STORIES:
3. As an Operator, I want to see how many replicas are healthy/degraded/unavailable so I can assess system reliability at a glance.
6. As an Operator, I want to pause the live event feed to analyze a particular event cluster without new events scrolling past.
15. As a Data Analyst, I want to group closely-timed events into "incidents" so I can analyze coordinated or cascading seismic activity.
16. As a Data Analyst, I want to see which events were confirmed by majority vote across replicas so I can assess detection consensus quality.
18. As a Data Analyst, I want to compare event counts and frequency profiles across two sensors side-by-side so I can identify sensor anomalies or regional differences.
19. As a System Administrator, I want to see which replicas are healthy and which are down so I can quickly identify infrastructure failures.
20. As a System Administrator, I want to download system metrics (uptime, reconnects, CPU/memory if available) so I can feed them into monitoring dashboards.
21. As a System Administrator, I want to see how many reconnect events have occurred so I can detect flaky connections.
22. As a System Administrator, I want to verify backend connectivity status so I can validate deployment health during startup.
23. As a System Administrator, I want to receive visual alerts when a replica goes down or enters degraded state so I can respond quickly to failures.
25. As a System Administrator,  I want the health status to be continuously updated via WebSocket so I can monitor fixes in real time.

### PORTS: 
8090:8090

### DESCRIPTION:
The Processing-Replica container processes incoming seismic events from the broker, applies classification algorithms, evaluates rule models for alerts, and participates in consensus voting for event confirmation. It also monitors and reports its own health status.

### PERSISTANCE EVALUATION
The Processing-Replica container requires persistent storage to store processed events, classification results, and replica health metrics in the Neo4j database.

### EXTERNAL SERVICES CONNECTIONS
The Processing-Replica container connects to the Sensor-Broker for event streams and to the Database container for persistence.

### MICROSERVICES:

#### MICROSERVICE: replica
- TYPE: backend
- DESCRIPTION: Processes events with FFT analysis, applies rules, performs consensus voting, and stores results.
- PORTS: 8090
- TECHNOLOGICAL SPECIFICATION:
The microservice is developed in Python using FastAPI for the API, Uvicorn as ASGI server, NumPy for signal processing, httpx for HTTP clients, websockets for WebSocket connections, and Neo4j driver for database interactions.
- SERVICE ARCHITECTURE:
The service uses FastAPI for REST endpoints, async processing for event handling, and direct Neo4j writes for persistence.
- ENDPOINTS:
		
	| HTTP METHOD | URL | Description | User Stories |
	| ----------- | --- | ----------- | ------------ |
    | POST | /process | Process incoming event and return classification | 3, 6, 15, 16, 18 |
    | GET | /health | Report replica health status | 19-23 |

- DB STRUCTURE: 

	**_Event_** :	| **_id_** | source | type | severity | timestamp | location | magnitude | classification | confidence | metadata |
    **_Replica_** :	| **_id_** | status | uptime | reconnects | lost_events |

## CONTAINER_NAME: Backend-API

### DESCRIPTION: 
Provides aggregated endpoints for dashboard and analytics clients. Serves sensor metadata, event lists, and historical queries.

### USER STORIES:
8. As an Operator, I want events color-coded by severity (NUCLEAR in red, EXPLOSION in orange, EARTHQUAKE in yellow) so incident criticality is instantly visible.
10. As a Data Analyst, I want to filter history by event type (EARTHQUAKE/EXPLOSION/NUCLEAR) so I can analyze specific seismic phenomena.
11. As a Data Analyst, I want to narrow results by sensor ID or geographic region so I can study localized activity patterns.
12. As a Data Analyst, I want to select custom date/time ranges and use preset shortcuts (Last Hour, Today, Last Week) so I can quickly review specific time windows.
13. As a Data Analyst, I want to download filtered results as CSV/JSON so I can perform advanced statistical analysis in external tools.
14. As a Data Analyst, I want to see events plotted on a timeline so I can identify temporal clustering and event sequences.
16. As a Data Analyst, I want to see which events were confirmed by majority vote across replicas so I can assess detection consensus quality.
17. As a Data Analyst, I want to see the events timeline given a specific region so I can identify spatial-temporal patterns.
25. As a System Administrator,  I want the health status to be continuously updated via WebSocket so I can monitor fixes in real time.

### PORTS: 
8080:8080

### DESCRIPTION:
The Backend-API container provides RESTful endpoints for the frontend dashboard, aggregating data from the database and replicas to serve sensor metadata, event histories, and analytics queries.

### PERSISTANCE EVALUATION
The Backend-API container requires persistent storage to query and aggregate event data, sensor information, and replica statuses from the database.

### EXTERNAL SERVICES CONNECTIONS
The Backend-API container connects to the Database container for data retrieval and to the Sensor-Broker for real-time updates.

### MICROSERVICES:

#### MICROSERVICE: backend
- TYPE: backend
- DESCRIPTION: Provides REST API for event queries, sensor data, and analytics aggregation.
- PORTS: 8080
- TECHNOLOGICAL SPECIFICATION:
The microservice is developed in Java using Spring Boot 2.7.4, with Spring Data JPA for database access, MySQL Connector for database connectivity, and Maven for build management.
- SERVICE ARCHITECTURE:
The service uses Spring Boot controllers for endpoints, repositories for database queries, and services for business logic.
- ENDPOINTS:
		
	| HTTP METHOD | URL | Description | User Stories |
	| ----------- | --- | ----------- | ------------ |
    | GET | /events | Retrieve filtered event list | 8, 10-14, 16, 17 |
    | GET | /sensors | Get sensor metadata | 1, 5 |
    | GET | /replicas | Get replica statuses | 3, 19-23 |
    | WS | /health/ws | WebSocket for continuous health status updates | 25 |

- DB STRUCTURE: 

	**_Event_** :	| **_id_** | source | type | severity | timestamp | location | magnitude | classification | confidence | metadata |
    **_Sensor_** :	| **_id_** | location | status |
    **_Replica_** :	| **_id_** | status | uptime |

## CONTAINER_NAME: Frontend

### DESCRIPTION: 
User interface for operators, analysts, and admins. Real-time map, event feed, filters, and system status views.

### USER STORIES:
- all

### PORTS: 
3000:3000

### DESCRIPTION:
The Frontend container serves the web application for real-time monitoring, providing maps, event feeds, filters, and administrative controls.

### PERSISTANCE EVALUATION
The Frontend container does not require data persistence as it is a client-side application.

### EXTERNAL SERVICES CONNECTIONS
The Frontend container connects to the Backend-API for data and to the Sensor-Broker for real-time streams.

### MICROSERVICES:

#### MICROSERVICE: webapp
- TYPE: frontend
- DESCRIPTION: React-based UI for dashboards, maps, and controls.
- PORTS: 3000
- TECHNOLOGICAL SPECIFICATION:
The microservice is developed in TypeScript using React with Vite for build tooling, and standard web technologies for UI rendering.
- SERVICE ARCHITECTURE:
The service uses React components for UI, hooks for state management, and API calls for data fetching.
- ENDPOINTS:
		
	| HTTP METHOD | URL | Description | User Stories |
	| ----------- | --- | ----------- | ------------ |
    | GET | / | Main dashboard | all |

## CONTAINER_NAME: Database

### DESCRIPTION: 
Stores events, sensors, replicas, and rules data.

### USER STORIES:
- all (data persistence)

### PORTS: 
7687:7687 (Neo4j)

### DESCRIPTION:
The Database container manages persistent storage using Neo4j graph database for events and relationships.

### PERSISTANCE EVALUATION
The Database container provides persistent storage for all system data.

### EXTERNAL SERVICES CONNECTIONS
The Database container is connected by Backend-API and Processing-Replica.

### MICROSERVICES:

#### MICROSERVICE: neo4j
- TYPE: database
- DESCRIPTION: Graph database for storing events and metadata.
- PORTS: 7687
- TECHNOLOGICAL SPECIFICATION:
Neo4j graph database for data storage and querying.
- SERVICE ARCHITECTURE:
Standard Neo4j setup with Cypher queries.
- ENDPOINTS:
		
	| HTTP METHOD | URL | Description | User Stories |
	| ----------- | --- | ----------- | ------------ |
    | - | - | Database queries | all |

## CONTAINER_NAME: Database

### DESCRIPTION: 
Stores events, sensors, replicas, and rules data.

### USER STORIES:
- all (data persistence)

### PORTS: 
7687:7687 (Neo4j)

### DESCRIPTION:
The Database container manages persistent storage using Neo4j graph database for events and relationships.

### PERSISTANCE EVALUATION
The Database container provides persistent storage for all system data.

### EXTERNAL SERVICES CONNECTIONS
The Database container is connected by Backend-API and Processing-Replica.

### MICROSERVICES:

#### MICROSERVICE: neo4j
- TYPE: database
- DESCRIPTION: Graph database for storing events and metadata.
- PORTS: 7687
- TECHNOLOGICAL SPECIFICATION:
Neo4j graph database for data storage and querying.
- SERVICE ARCHITECTURE:
Standard Neo4j setup with Cypher queries.
- ENDPOINTS:
		
	| HTTP METHOD | URL | Description | User Stories |
	| ----------- | --- | ----------- | ------------ |
    | - | - | Database queries | all |

## Standard Event Schema

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

## Rule Model

The rule model is not yet implemented in the current codebase. Classification is based on fixed frequency thresholds in the analyzer (0.5-3.0 Hz: EARTHQUAKE, 3.0-8.0 Hz: CONVENTIONAL_EXPLOSION, >=8.0 Hz: NUCLEAR_EVENT). Future enhancements may include dynamic rules for alerts and actions.

# DATABASE:

- SeismicEvent nodes (id, timestamp, frequency, classification, confirmed, sensorId, region, lat, lon)
- Sensor nodes (id, lat, lon, region)
- Region nodes (name)
- Replica nodes (id, status, uptime)
- Relationships: DETECTED (Sensor -> Event), OCCURRED_IN (Event -> Region), REPORTED (Replica -> Event)

# WORKFLOW:

1. Sensor emits event to Sensor-Broker.
2. Broker validates schema and broadcasts to replicas.
3. Replicas classify and evaluate rule model.
4. Consensus engine confirms event and stores to DB.
5. Backend-API exposes concise data for Frontend real-time dashboards.
