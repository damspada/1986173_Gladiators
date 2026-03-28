# 🛰️ Seismic Processing Service

## Neo4j Integration & Technical Guide

This document describes the **Processing Service** (Role 2: Data Engineer & Algorithms) and its integration with a **Neo4j Graph Database**.

---

## 📌 Overview

The Processing Service is a **FastAPI-based microservice** that performs real-time seismic signal analysis using **Fast Fourier Transform (FFT)**.

Its responsibilities:

* Analyze incoming seismic signals
* Classify events based on dominant frequency
* Forward structured events to a **Graph Database** via a Gateway

---

## 📥 Data Ingestion (From Role 1 / Broker)

The service acts as an **SSE client**, consuming a continuous stream of measurements from the Internal Broker.

### Endpoint

```http
GET http://broker:8080/stream
```

### Format

* **Protocol:** Server-Sent Events (SSE)
* Each `data:` line contains a JSON object

### Required Fields

```json
{
  "sensor_id": "sensor-01",
  "timestamp": "2026-03-25T00:00:00.000000+00:00",
  "value": 0.123456
}
```

---

## 🧩 Neo4j Integration & Idempotency (Role 3)

This system uses **Neo4j**, so event handling is optimized for:

* Graph modeling
* Duplicate prevention

---

### 🔁 The Importance of `event_id` (MD5 Hash)

In a replicated environment (multiple processing nodes), the same event may be detected simultaneously.

To prevent duplicate nodes in Neo4j:

**Deterministic ID generation:**

```
event_id = md5(sensor_id + timestamp_minute_precision)
```

---

### 🧠 Usage in Neo4j (Cypher)

The backend should use the `MERGE` clause:

```cypher
MERGE (e:Event {event_id: $event_id})
ON CREATE SET 
  e.type = $type,
  e.frequency = $frequency,
  e.detected_at = $timestamp
```

✅ This ensures:

* Only one node is created per event
* Duplicate reports from multiple replicas are ignored

---

## 📤 Graph Data Payload (POST to Gateway)

The Processing Service forwards the following JSON to `GATEWAY_URL`:

```json
{
  "event_id": "a1b2c3d4e5f6...",
  "sensor_id": "sensor-01",
  "type": "EARTHQUAKE",
  "frequency": 1.65,
  "detected_at": "2026-03-25T...",
  "window_size_sec": 10
}
```

### 🔗 Graph Modeling Hint

* `(Sensor)-[:DETECTED]->(Event)`
* `sensor_id` is used to create relationships between nodes

---

## 🛡️ Fault Tolerance

### 🔌 Replica Shutdown

The service listens to the control SSE stream:

```http
GET /api/control
```

If the following message is received:

```json
{ "command": "SHUTDOWN" }
```

➡️ The replica terminates immediately:

```python
os._exit(1)
```

---

### ❤️ Health Monitoring

Each replica exposes:

```http
GET /health
```

**Response:**

```json
{ "status": "healthy" }
```

Used by:

* Gateway
* Load balancer

---

## 🧠 Algorithmic Logic

### Window Configuration

* **Window Size:** 200 samples
* **Duration:** 10 seconds @ 20Hz

---

### ⚙️ FFT Processing

* Uses **Real FFT (`rfft`)**
* Extracts magnitude spectrum
* Identifies dominant frequency peak

---

### 📊 Classification Thresholds

| Frequency Range | Event Type                |
| --------------- | ------------------------- |
| 0.5 – 3.0 Hz    | 🌍 EARTHQUAKE             |
| 3.0 – 8.0 Hz    | 💥 CONVENTIONAL_EXPLOSION |
| > 8.0 Hz        | ☢️ NUCLEAR_EVENT          |

---

## 🚀 Summary

This Processing Service:

* Consumes real-time data via SSE
* Performs FFT-based signal analysis
* Ensures idempotent event creation in Neo4j
* Supports horizontal scaling with replica-safe logic

---

## 📬 Integration Notes

* Ensure SSE stream reliability from the Broker
* Use `MERGE` in Neo4j to enforce uniqueness
* Always generate deterministic `event_id`
* Monitor `/health` for orchestration

---
