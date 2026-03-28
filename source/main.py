import os
import json
import asyncio
import httpx
import hashlib
from fastapi import FastAPI
from contextlib import asynccontextmanager
from analyzer import SeismicAnalyzer

# Environment variables for service discovery and communication
SIMULATOR_URL = os.getenv("SIMULATOR_URL", "http://localhost:8080")
BROKER_URL = os.getenv("BROKER_URL", "http://localhost:9090/stream")
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://gateway:8080/api/events")

# Global HTTP client to manage connection pooling efficiently
http_client = httpx.AsyncClient()

async def listen_to_broker(app):
    """
    Consumes the SSE (Server-Sent Events) stream from the Internal Broker.
    This replaces the 'requests + threading' approach with a non-blocking 
    asynchronous loop, ensuring the service remains responsive.
    """
    print(f"[*] Connecting to Internal Broker SSE stream: {BROKER_URL}")
    while True:
        try:
            # timeout=None is required for long-lived SSE connections
            async with http_client.stream("GET", BROKER_URL, timeout=None) as response:
                print("[*] Successfully connected to Broker! Waiting for seismic data...")
                async for line in response.aiter_lines():
                    # SSE standard: data lines start with the 'data:' prefix
                    if line.startswith("data:"):
                        raw_json = line[5:].strip()
                        try:
                            msg = json.loads(raw_json)
                            # Feed the measurement into the analyzer's sliding window
                            event = app.state.analyzer.process_measurement(
                                msg['sensor_id'], 
                                msg['value']
                            )
                            
                            # If the analyzer detects an event after a full window (10s)
                            if event:
                                await handle_detection(event, msg['timestamp'])
                                
                        except (json.JSONDecodeError, KeyError):
                            # Skip malformed JSON or missing fields silently
                            continue
        except Exception as e:
            # Fault tolerance: retry connection every 5 seconds if the broker fails
            print(f"[!] Connection lost to broker: {e}. Retrying in 5s...")
            await asyncio.sleep(5)

async def handle_detection(event, timestamp):
    """
    Handles event reporting to the Gateway/Neo4j database.
    Generates a deterministic ID to handle duplicate reports from replicas.
    """
    # Deterministic MD5 hash for Neo4j 'MERGE' operations
    # Using sensor_id and timestamp (minute precision) to identify the same physical event
    unique_id = hashlib.md5(f"{event['sensor_id']}-{timestamp[:16]}".encode()).hexdigest()
    
    payload = {
        "event_id": unique_id,
        "sensor_id": event["sensor_id"],
        "type": event["event_type"],
        "frequency": event["dominant_frequency"],
        "timestamp": timestamp,
        "window_size_sec": 10
    }
    
    print(f"[ALERT] {payload['type']} detected by {payload['sensor_id']}! Frequency: {payload['frequency']} Hz")
    
    try:
        # Fire-and-forget background task to send the alert to the Gateway
        asyncio.create_task(http_client.post(GATEWAY_URL, json=payload, timeout=1.0))
    except Exception:
        # Prevent detection logic from crashing if the Gateway is unreachable
        pass

async def listen_to_control_stream():
    """
    Listens to the official Simulator control stream for SHUTDOWN commands.
    As per API_CONTRACT.md, only one replica is terminated per command.
    """
    control_url = f"{SIMULATOR_URL}/api/control"
    try:
        async with http_client.stream("GET", control_url, timeout=None) as response:
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    data_str = line[5:].strip()
                    payload = json.loads(data_str)
                    # Mandatory requirement: forced exit on SHUTDOWN command
                    if payload.get("command") == "SHUTDOWN":
                        print("[!] Received SHUTDOWN command from simulator. Exiting now.")
                        os._exit(1)
    except Exception:
        pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the lifecycle of the FastAPI application.
    Starts background tasks upon startup and cleans up upon shutdown.
    """
    # Initialize the analyzer (Default sampling rate is 20Hz as per DOCKER_CONTRACT.md)
    app.state.analyzer = SeismicAnalyzer(sampling_rate=20.0) 
    
    # Start background ingestion and control tasks
    broker_task = asyncio.create_task(listen_to_broker(app))
    control_task = asyncio.create_task(listen_to_control_stream())
    
    yield
    
    # Cleanup tasks and close HTTP client gracefully on shutdown
    broker_task.cancel()
    control_task.cancel()
    await http_client.aclose()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    """
    Standard health check endpoint for the Gateway/Load Balancer.
    """
    return {"status": "healthy"}