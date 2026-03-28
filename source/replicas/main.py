import os
import json
import asyncio
import httpx
import hashlib
import socket
from fastapi import FastAPI
from contextlib import asynccontextmanager
from analyzer import SeismicAnalyzer
from neo4j import AsyncGraphDatabase

REPLICA_ID = socket.gethostname()

# Environment variables for service discovery and communication
SIMULATOR_URL = os.getenv("SIMULATOR_URL", "http://simulator:8080")
BROKER_URL = os.getenv("BROKER_URL", "http://broker:9090/stream")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# Global HTTP client for the control stream
http_client = httpx.AsyncClient()

# Neo4j async driver (initialized in lifespan)
neo4j_driver = None

async def listen_to_broker(app):
    """
    Consumes the SSE (Server-Sent Events) stream from the Internal Broker.
    """
    print(f"[*] Broker URL  : {BROKER_URL}")
    print(f"[*] Neo4j URI   : {NEO4J_URI}")
    print(f"[*] Simulator   : {SIMULATOR_URL}")

    messages_received = 0
    events_detected = 0

    print(f"[*] Connecting to Internal Broker SSE stream: {BROKER_URL}")
    while True:
        try:
            async with http_client.stream("GET", BROKER_URL, timeout=None) as response:
                print(f"[*] Successfully connected to Broker! (HTTP {response.status_code}) Waiting for seismic data...")
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        raw_json = line[5:].strip()
                        try:
                            msg = json.loads(raw_json)
                            messages_received += 1
                            if messages_received % 200 == 0:
                                print(f"[~] {messages_received} measurements received so far ({events_detected} events detected)")

                            event = app.state.analyzer.process_measurement(
                                msg['sensor_id'],
                                msg['value']
                            )

                            if event:
                                events_detected += 1
                                await handle_detection(event, msg['timestamp'], msg)

                        except (json.JSONDecodeError, KeyError) as e:
                            print(f"[!] Malformed message from broker: {e} — raw: {line[:120]}")
                            continue
        except Exception as e:
            print(f"[!] Connection lost to broker: {e}. Retrying in 5s...")
            await asyncio.sleep(5)

async def handle_detection(event, timestamp, metadata):
    """
    Persists a detected seismic event directly into Neo4j.
    Uses MERGE on event_id to ensure idempotency across replicas.
    """
    # Deterministic MD5 hash — same event detected by multiple replicas produces same ID
    unique_id = hashlib.md5(f"{event['sensor_id']}-{timestamp[:16]}".encode()).hexdigest()

    print(f"[ALERT] {event['event_type']} detected by {event['sensor_id']}! "
          f"Frequency: {event['dominant_frequency']} Hz — saving to Neo4j...")

    try:
        async with neo4j_driver.session() as session:
            await session.run(
                """
                MERGE (e:SeismicEvent {eventId: $event_id})
                ON CREATE SET
                    e.sensorId    = $sensor_id,
                    e.timestamp   = $timestamp,
                    e.frequency   = $frequency,
                    e.amplitude   = 0.0,
                    e.classification = $classification,
                    e.lat         = $lat,
                    e.lon         = $lon,
                    e.region      = $region
                """,
                event_id=unique_id,
                sensor_id=event["sensor_id"],
                timestamp=timestamp,
                frequency=event["dominant_frequency"],
                classification=event["event_type"],
                lat=metadata.get("lat", 0.0),
                lon=metadata.get("lon", 0.0),
                region=metadata.get("region", ""),
            )
        print(f"[OK] Event {unique_id} saved.")
    except Exception as e:
        print(f"[!] Failed to save event to Neo4j: {e}")

async def listen_to_control_stream():
    """
    Listens to the official Simulator control stream for SHUTDOWN commands.
    """
    control_url = f"{SIMULATOR_URL}/api/control"
    print(f"[*] Listening to simulator control stream: {control_url}")
    while True:
        try:
            async with http_client.stream("GET", control_url, timeout=None) as response:
                print(f"[*] Connected to simulator control stream (HTTP {response.status_code})")
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        payload = json.loads(data_str)
                        if payload.get("command") == "SHUTDOWN":
                            print(f"[!!!] SHUTDOWN command received by replica {REPLICA_ID}. Terminating now.")
                            os._exit(1)
        except Exception as e:
            print(f"[!] Control stream error: {e}. Retrying in 5s...")
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the lifecycle of the FastAPI application.
    Starts background tasks upon startup and cleans up upon shutdown.
    """
    global neo4j_driver
    print(f"[*] Initializing replica {REPLICA_ID}...")
    print(f"[*] Connecting to Neo4j at {NEO4J_URI}...")
    neo4j_driver = AsyncGraphDatabase.driver(
        NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)
    )
    # Verify connectivity immediately so failures are visible at startup
    try:
        await neo4j_driver.verify_connectivity()
        print(f"[*] Neo4j connection OK.")
    except Exception as e:
        print(f"[!] Neo4j connection FAILED: {e}")

    # Initialize the analyzer (Default sampling rate is 20Hz as per DOCKER_CONTRACT.md)
    app.state.analyzer = SeismicAnalyzer(sampling_rate=20.0)
    print(f"[*] SeismicAnalyzer ready (window=200 samples @ 20Hz)")

    # Start background ingestion and control tasks
    broker_task = asyncio.create_task(listen_to_broker(app))
    control_task = asyncio.create_task(listen_to_control_stream())

    yield

    # Cleanup: cancel tasks, close driver and HTTP client
    broker_task.cancel()
    control_task.cancel()
    await neo4j_driver.close()
    await http_client.aclose()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    """
    Standard health check endpoint for the Gateway/Load Balancer.
    """
    return {"status": "healthy"}