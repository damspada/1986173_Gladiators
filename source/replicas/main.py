import os
import sys
import json
import asyncio
import httpx
import socket
from fastapi import FastAPI
from contextlib import asynccontextmanager
from analyzer import SeismicAnalyzer
from neo4j_repository import create_repository

REPLICA_ID = socket.gethostname()

# Environment variables for service discovery and communication
SIMULATOR_URL = os.getenv("SIMULATOR_URL", "http://simulator:8080")
BROKER_URL = os.getenv("BROKER_URL", "http://broker:9090/stream")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8090")

# Global HTTP client for the control stream
http_client = httpx.AsyncClient(headers={"X-Replica-ID": REPLICA_ID})

async def listen_to_broker(app):
    """
    Consumes the SSE (Server-Sent Events) stream from the Internal Broker.
    """
    print(f"[*] Broker URL  : {BROKER_URL}")
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
                                await handle_detection(app, event, msg['timestamp'], msg)

                        except (json.JSONDecodeError, KeyError) as e:
                            print(f"[!] Malformed message from broker: {e} — raw: {line[:120]}")
                            continue
                        except Exception as e:
                            print(f"[!] Error processing event: {e}")
                            continue
        except Exception as e:
            print(f"[!] Connection lost to broker: {e}. Retrying in 5s...")
            await asyncio.sleep(5)

async def handle_detection(app, event, timestamp, metadata):
    """
    Delegates persistence of a detected seismic event to the Neo4j repository,
    then notifies the backend so it can broadcast via WebSocket to frontends.
    """
    import hashlib
    await app.state.repo.save_seismic_event(event, timestamp, metadata)

    # Notify the backend for real-time WebSocket broadcast
    unique_id = hashlib.md5(
        f"{event['sensor_id']}-{timestamp[:16]}".encode()
    ).hexdigest()
    try:
        await http_client.post(f"{BACKEND_URL}/api/events", json={
            "event_id": unique_id,
            "sensor_id": event["sensor_id"],
            "type": event["event_type"],
            "frequency": event["dominant_frequency"],
            "timestamp": timestamp,
            "window_size_sec": 0,
            "lat": metadata.get("lat", 0.0),
            "lon": metadata.get("lon", 0.0),
            "region": metadata.get("region", "UNKNOWN"),
        })
    except Exception as e:
        print(f"[!] Failed to notify backend: {e}")

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
                            msg = f"\n{'='*80}\n[CRASH] Replica {REPLICA_ID} received SHUTDOWN command - Terminating.\n{'='*80}\n"
                            print(msg, file=sys.stderr, flush=True)
                            print(f"[!!!] SHUTDOWN command received by replica {REPLICA_ID}. Terminating now.", flush=True)
                            # Notify backend that this replica is shutting down
                            try:
                                await http_client.put(f"{BACKEND_URL}/api/replicas/{REPLICA_ID}/shutdown")
                                print(f"[!] Notified backend of shutdown for replica {REPLICA_ID}")
                            except Exception as e:
                                print(f"[!] Failed to notify backend of shutdown: {e}")
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
    print(f"[*] Initializing replica {REPLICA_ID}...")
    app.state.repo = await create_repository(REPLICA_ID)

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
    await app.state.repo.close()
    await http_client.aclose()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    """
    Standard health check endpoint for the Gateway/Load Balancer.
    """
    return {"status": "healthy"}