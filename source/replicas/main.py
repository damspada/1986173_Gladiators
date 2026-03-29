import os
import sys
import json
import asyncio
import logging
import httpx
import socket
from fastapi import FastAPI
from contextlib import asynccontextmanager
from analyzer import SeismicAnalyzer
from neo4j_repository import create_repository

LOGGING_LEVEL = os.getenv("LOGGING_LEVEL", "INFO").upper()

logging.basicConfig(
    level=LOGGING_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

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
    logger.info("Broker URL  : %s", BROKER_URL)
    logger.info("Simulator   : %s", SIMULATOR_URL)

    messages_received = 0
    events_detected = 0

    logger.info("Connecting to Internal Broker SSE stream: %s", BROKER_URL)
    while True:
        try:
            async with http_client.stream("GET", BROKER_URL, timeout=None) as response:
                logger.info("Successfully connected to Broker! (HTTP %s) Waiting for seismic data...", response.status_code)
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        raw_json = line[5:].strip()
                        try:
                            msg = json.loads(raw_json)
                            messages_received += 1
                            if messages_received % 200 == 0:
                                logger.debug("%d measurements received so far (%d events detected)", messages_received, events_detected)

                            event = app.state.analyzer.process_measurement(
                                msg['sensor_id'],
                                msg['value']
                            )

                            if event:
                                events_detected += 1
                                await handle_detection(app, event, msg['timestamp'], msg)

                        except (json.JSONDecodeError, KeyError) as e:
                            logger.warning("Malformed message from broker: %s — raw: %s", e, line[:120])
                            continue
                        except Exception as e:
                            logger.warning("Error processing event: %s", e)
                            continue
        except Exception as e:
            logger.warning("Connection lost to broker: %s. Retrying in 5s...", e)
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
        logger.warning("Failed to notify backend: %s", e)

async def listen_to_control_stream():
    """
    Listens to the official Simulator control stream for SHUTDOWN commands.
    """
    control_url = f"{SIMULATOR_URL}/api/control"
    logger.info("Listening to simulator control stream: %s", control_url)
    while True:
        try:
            async with http_client.stream("GET", control_url, timeout=None) as response:
                logger.info("Connected to simulator control stream (HTTP %s)", response.status_code)
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        payload = json.loads(data_str)
                        if payload.get("command") == "SHUTDOWN":
                            logger.critical("SHUTDOWN command received by replica %s — Terminating.", REPLICA_ID)
                            os._exit(1)
        except Exception as e:
            logger.warning("Control stream error: %s. Retrying in 5s...", e)
            await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the lifecycle of the FastAPI application.
    Starts background tasks upon startup and cleans up upon shutdown.
    """
    logger.info("Initializing replica %s...", REPLICA_ID)
    app.state.repo = await create_repository(REPLICA_ID)

    # Initialize the analyzer (Default sampling rate is 20Hz as per DOCKER_CONTRACT.md)
    app.state.analyzer = SeismicAnalyzer(sampling_rate=20.0)
    logger.info("SeismicAnalyzer ready (window=200 samples @ 20Hz)")

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