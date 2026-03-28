# 🛰️ Seismic Processing Service

## Technical Integration Guide

This document describes the **Processing Service**, a microservice responsible for real-time seismic signal analysis and event classification.

---

## 📌 Overview

The Processing Service is a **FastAPI-based microservice** that analyzes seismic signals using the **Fast Fourier Transform (FFT)**.

It classifies detected events into:

* 🌍 **Earthquakes**
* 💥 **Conventional Explosions**
* ☢️ **Nuclear-like Events**

Classification is based on dominant frequency peaks extracted from incoming signal data.

---

## ⚙️ Infrastructure & Deployment (Role 1)

The service is fully containerized and designed for horizontal scaling.

### Configuration

* **Port:** `8000`
* **Health Check Endpoint:**

  ```http
  GET /health
  ```

  **Response:**

  ```json
  { "status": "healthy" }
  ```

### SSE Control

The service automatically connects to the simulator stream:

```
/api/control
```

It listens for control messages such as:

* `SHUTDOWN`

---

### 🐳 Environment Variables

| Variable        | Description                       | Example                          |
| --------------- | --------------------------------- | -------------------------------- |
| `SIMULATOR_URL` | Base URL of the seismic simulator | `http://simulator:8080`          |
| `GATEWAY_URL`   | Destination for detected events   | `http://gateway:8080/api/events` |

---

## 📥 Data Ingestion (Role 1 / Broker)

To feed data into the processing engine, send an HTTP POST request for each new measurement.

### Endpoint

```http
POST /api/measurements
```

### Payload Format

```json
{
  "sensor_id": "sensor-01",
  "timestamp": "2026-03-25T00:00:00.000000+00:00",
  "value": 0.123456
}
```

### ⚠️ Important Note

The broker **must inject the `sensor_id` manually**, since the simulator’s raw WebSocket stream only provides:

* `timestamp`
* `value`

---

## 📤 Event Output & Idempotency (Role 3)

When an event is detected (after a **10-second sliding window**), the service sends an alert to:

```
GATEWAY_URL
```

---

### 🔁 Idempotency Strategy

Since multiple service replicas process the same data, duplicate detections are expected.

To handle this:

* Each event includes a deterministic `event_id`
* Generated using an **MD5 hash** of:

  ```
  sensor_id + timestamp (minute precision)
  ```

### ✅ Requirement

The receiving system (**Database / Gateway**) must:

* Use `event_id` as a **Primary Key** or **Unique Index**
* Ignore duplicate events from different replicas

---

### 📦 Alert Payload

```json
{
  "event_id": "a1b2c3d4...",
  "sensor_id": "sensor-01",
  "dominant_frequency": 1.6,
  "event_type": "EARTHQUAKE",
  "detected_at": "2026-03-25T00:00:10...",
  "window_size_sec": 10
}
```

---

## 🧠 Algorithmic Logic

### Window Configuration

* **Window Size:** 200 samples
* **Duration:** 10 seconds @ 20Hz sampling rate

---

### 📊 Classification Criteria

| Frequency Range | Event Type                |
| --------------- | ------------------------- |
| 0.5 – 3.0 Hz    | 🌍 Earthquake             |
| 3.0 – 8.0 Hz    | 💥 Conventional Explosion |
| > 8.0 Hz        | ☢️ Nuclear-like Event     |

---

## 🚀 Summary

The Processing Service provides:

* Real-time seismic signal analysis
* Deterministic event detection across replicas
* Scalable, containerized deployment
* Clear integration points for ingestion and output

---

## 📬 Contributing / Integration

For integration questions:

* Ensure correct payload formatting
* Implement idempotent storage using `event_id`
* Validate connectivity with `/health`

---
