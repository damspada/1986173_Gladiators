import os
import json
import asyncio
import httpx
import hashlib
from fastapi import FastAPI
from contextlib import asynccontextmanager
from analyzer import SeismicAnalyzer

# Environment variables
SIMULATOR_URL = os.getenv("SIMULATOR_URL", "http://localhost:8080")
BROKER_URL = os.getenv("BROKER_URL", "http://broker:8080/stream")
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://gateway:8080/api/events")

http_client = httpx.AsyncClient()

async def listen_to_data_stream(app):
    """
    Consumes the SSE stream from the Broker (Team Member 1).
    Equivalent to the 'requests.get(stream=True)' logic provided by your colleague.
    """
    print(f"[*] Connecting to Data Stream at {BROKER_URL}...")
    while True:
        try:
            async with http_client.stream("GET", BROKER_URL, timeout=None) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        # Extract JSON string after 'data:'
                        json_str = line[5:].strip()
                        try:
                            data = json.loads(json_str)
                            
                            # Process the measurement through your analyzer
                            event = app.state.analyzer.process_measurement(
                                data["sensor_id"], 
                                data["value"]
                            )
                            
                            if event:
                                # Idempotency logic: unique hash for the event
                                unique_string = f"{event['sensor_id']}-{data['timestamp'][:16]}"
                                event_id = hashlib.md5(unique_string.encode()).hexdigest()
                                
                                alert = {
                                    "event_id": event_id,
                                    **event,
                                    "detected_at": data["timestamp"]
                                }
                                
                                # Send alert to Gateway in background
                                print(f"[!] ALERT DETECTED: {alert['event_type']}")
                                asyncio.create_task(http_client.post(GATEWAY_URL, json=alert, timeout=1.0))
                                
                        except (json.JSONDecodeError, KeyError) as e:
                            continue
        except Exception as e:
            print(f"Data stream connection lost: {e}. Retrying in 5s...")
            await asyncio.sleep(5)

async def listen_to_control_stream():
    """
    Listens to the official Simulator control stream for SHUTDOWN commands.
    Ref: API_CONTRACT.md
    """
    control_url = f"{SIMULATOR_URL}/api/control"
    try:
        async with http_client.stream("GET", control_url, timeout=None) as response:
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    data_str = line[5:].strip()
                    payload = json.loads(data_str)
                    # Ref: API_CONTRACT.md -> ShutdownCommand
                    if payload.get("command") == "SHUTDOWN":
                        print("Received SHUTDOWN command. Terminating replica.")
                        os._exit(1)
    except Exception:
        pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize analyzer with actual sampling rate
    try:
        resp = await http_client.get(f"{SIMULATOR_URL}/health")
        rate = resp.json().get("samplingRateHz", 20.0)
    except:
        rate = 20.0
        
    app.state.analyzer = SeismicAnalyzer(sampling_rate=rate)
    
    # Start background tasks
    data_task = asyncio.create_task(listen_to_data_stream(app))
    control_task = asyncio.create_task(listen_to_control_stream())
    
    yield
    
    data_task.cancel()
    control_task.cancel()
    await http_client.aclose()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "healthy"}