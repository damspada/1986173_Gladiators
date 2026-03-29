import os
import asyncio
import hashlib
from neo4j import AsyncGraphDatabase
from neo4j.exceptions import TransientError, DatabaseError

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# Majority confirmation threshold: floor(N/2) + 1 replicas must REPORT an event
# before a (:Region)-[:CONFIRMED]->(:SeismicEvent) relationship is created.
REPLICA_COUNT = int(os.getenv("REPLICA_COUNT", "3"))
_MAJORITY_THRESHOLD = REPLICA_COUNT // 2 + 1

# Constraints to apply at startup — one statement each for clarity
_CONSTRAINTS = [
    ("CREATE CONSTRAINT seismic_event_id IF NOT EXISTS "
     "FOR (e:SeismicEvent) REQUIRE e.eventId IS UNIQUE"),
    ("CREATE CONSTRAINT sensor_id IF NOT EXISTS "
     "FOR (s:Sensor) REQUIRE s.sensorId IS UNIQUE"),
    ("CREATE CONSTRAINT region_name IF NOT EXISTS "
     "FOR (r:Region) REQUIRE r.name IS UNIQUE"),
    ("CREATE CONSTRAINT replica_id IF NOT EXISTS "
     "FOR (r:Replica) REQUIRE r.replicaId IS UNIQUE"),
]

# Graph query that builds the full relationship model on every detected event.
#
# Graph shape produced:
#   (:Replica)-[:REPORTED]->(:SeismicEvent)-[:OCCURRED_IN]->(:Region)
#   (:Sensor)-[:DETECTED]->(:SeismicEvent)
#   (:Sensor)-[:LOCATED_IN]->(:Region)
#   (:Region)-[:CONFIRMED]->(:SeismicEvent)   ← only once majority threshold is reached
#
# * MERGE ensures every node and relationship is created at most once, so the
#   query is fully idempotent even when multiple replicas detect the same event.
# * point() / datetime() use native Neo4j types for geo and time operations.
_SAVE_EVENT_QUERY = """
MERGE (sensor:Sensor {sensorId: $sensor_id})
ON CREATE SET sensor.location = point({latitude: $lat, longitude: $lon})

MERGE (region:Region {name: $region})

MERGE (replica:Replica {replicaId: $replica_id})

MERGE (sensor)-[:LOCATED_IN]->(region)

MERGE (event:SeismicEvent {eventId: $event_id})
ON CREATE SET
    event.timestamp      = datetime($timestamp),
    event.frequency      = $frequency,
    event.classification = $classification,
    event.location       = point({latitude: $lat, longitude: $lon})

// Add classification as an extra label so Neo4j Browser can assign a distinct
// colour and size per event type. SET inside FOREACH is idempotent (no-op if the
// label already exists), so this is safe to run on every replica write.
FOREACH (_ IN CASE WHEN $classification = 'EARTHQUAKE'             THEN [1] ELSE [] END | SET event:EARTHQUAKE)
FOREACH (_ IN CASE WHEN $classification = 'CONVENTIONAL_EXPLOSION' THEN [1] ELSE [] END | SET event:CONVENTIONAL_EXPLOSION)
FOREACH (_ IN CASE WHEN $classification = 'NUCLEAR_EVENT'          THEN [1] ELSE [] END | SET event:NUCLEAR_EVENT)

MERGE (event)-[:OCCURRED_IN]->(region)
MERGE (sensor)-[:DETECTED]->(event)
MERGE (replica)-[reported:REPORTED]->(event)
ON CREATE SET reported.detectedAt = datetime($timestamp)

// Majority confirmation: count all replicas that have REPORTED this event.
// Once the count reaches the majority threshold, stamp the event as confirmed
// and create a (:Region)-[:CONFIRMED]->(:SeismicEvent) relationship.
// The WHERE clause acts as a guard — if threshold not yet met, nothing below runs.
WITH event, region
MATCH (r:Replica)-[:REPORTED]->(event)
WITH event, region, count(r) AS reporters
WHERE reporters >= $majority_threshold
MERGE (region)-[:CONFIRMED]->(event)
SET event.confirmed = true
"""


class Neo4jRepository:
    def __init__(self, uri: str, user: str, password: str, replica_id: str):
        self._driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
        self._replica_id = replica_id

    async def verify_connectivity(self):
        await self._driver.verify_connectivity()

    async def create_constraints(self):
        """
        Applies all schema constraints. Safe to run on every startup (IF NOT EXISTS).

        Handles two concurrent-startup failure modes gracefully:
        - TransientError (DeadlockDetected): multiple replicas hit the schema lock
          simultaneously → retry with backoff.
        - DatabaseError (ConstraintCreationFailed): duplicate data written before the
          constraint was in place → log a warning and continue. MERGE-based writes
          remain idempotent even without the constraint.
        """
        for statement in _CONSTRAINTS:
            for attempt in range(1, 4):
                try:
                    async with self._driver.session() as session:
                        await session.run(statement)
                    break
                except TransientError as e:
                    if attempt == 3:
                        print(f"[!] Constraint deadlock after 3 attempts, skipping: {e}")
                        break
                    wait = attempt * 2
                    print(f"[~] Constraint deadlock (attempt {attempt}), retrying in {wait}s...")
                    await asyncio.sleep(wait)
                except DatabaseError as e:
                    print(f"[!] Constraint creation skipped (data conflict or already exists): {e.message}")
                    break
        print("[*] Neo4j constraints applied.")

    async def save_seismic_event(self, event: dict, timestamp: str, metadata: dict):
        """
        Persists a detected seismic event as a fully connected graph:
            (Replica)-[:REPORTED]->(SeismicEvent)-[:OCCURRED_IN]->(Region)
            (Sensor)-[:DETECTED]->(SeismicEvent)
            (Sensor)-[:LOCATED_IN]->(Region)

        The deterministic eventId means multiple replicas detecting the same
        physical event converge on one SeismicEvent node, each adding their
        own REPORTED edge — enabling corroboration queries.
        """
        unique_id = hashlib.md5(
            f"{event['sensor_id']}-{timestamp[:16]}".encode()
        ).hexdigest()

        print(
            f"[ALERT] {event['event_type']} detected by {event['sensor_id']}! "
            f"Frequency: {event['dominant_frequency']} Hz — saving to Neo4j..."
        )

        async with self._driver.session() as session:
            await session.run(
                _SAVE_EVENT_QUERY,
                event_id=unique_id,
                sensor_id=event["sensor_id"],
                timestamp=timestamp,
                frequency=event["dominant_frequency"],
                classification=event["event_type"],
                lat=metadata.get("lat", 0.0),
                lon=metadata.get("lon", 0.0),
                region=metadata.get("region", "UNKNOWN"),
                replica_id=self._replica_id,
                majority_threshold=_MAJORITY_THRESHOLD,
            )
        print(f"[OK] Event {unique_id} saved by replica {self._replica_id}.")

    async def close(self):
        await self._driver.close()


async def create_repository(replica_id: str) -> "Neo4jRepository":
    """
    Factory: initialises the driver, verifies connectivity, and applies constraints.
    Retries on ServiceUnavailable (Neo4j still booting) with exponential backoff.
    """
    from neo4j.exceptions import ServiceUnavailable

    print(f"[*] Connecting to Neo4j at {NEO4J_URI}...")
    repo = Neo4jRepository(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, replica_id)

    for attempt in range(1, 11):
        try:
            await repo.verify_connectivity()
            print("[*] Neo4j connection OK.")
            break
        except ServiceUnavailable as e:
            if attempt == 10:
                raise
            wait = min(attempt * 3, 20)
            print(f"[~] Neo4j not ready (attempt {attempt}/10), retrying in {wait}s... ({e})")
            await asyncio.sleep(wait)

    await repo.create_constraints()
    return repo
