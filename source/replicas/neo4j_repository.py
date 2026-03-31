import os
import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from neo4j import AsyncGraphDatabase
from neo4j.exceptions import TransientError, DatabaseError

logger = logging.getLogger(__name__)

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
    ("CREATE CONSTRAINT reporting_id IF NOT EXISTS "
     "FOR (r:Reporting) REQUIRE r.reportingId IS UNIQUE"),
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
#   (:Replica)-[:DETECTED]->(:SeismicEvent)-[:PART_OF]->(:Reporting)-[:OCCURRED_IN]->(:Region)
#   (:Sensor)-[:OBSERVED]->(:Reporting)
#   (:Sensor)-[:LOCATED_IN]->(:Region)
#   (:Region)-[:CONFIRMED]->(:Reporting)   ← only once majority threshold is reached
#
# SeismicEvent = individual detection by one replica (frequency + classification).
# Reporting    = aggregated physical event (avg frequency, highest classification).
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

// --- Individual detection (one per replica per physical event) ---
MERGE (event:SeismicEvent {eventId: $event_id})
ON CREATE SET
    event.timestamp      = $timestamp,
    event.frequency      = $frequency,
    event.classification = $classification,
    event.sensorId       = $sensor_id,
    event.replicaId      = $replica_id

MERGE (replica)-[:DETECTED]->(event)

// --- Aggregated reporting (one per physical event) ---
MERGE (reporting:Reporting {reportingId: $reporting_id})
ON CREATE SET
    reporting.timestamp = $timestamp,
    reporting.sensorId  = $sensor_id,
    reporting.region    = $region,
    reporting.lat       = $lat,
    reporting.lon       = $lon,
    reporting.location  = point({latitude: $lat, longitude: $lon})

MERGE (event)-[:PART_OF]->(reporting)
MERGE (sensor)-[:OBSERVED]->(reporting)
MERGE (reporting)-[:OCCURRED_IN]->(region)

// Recalculate aggregated fields from ALL linked individual events.
// Highest classification = most severe (NUCLEAR > CONVENTIONAL > EARTHQUAKE).
// Avg frequency = mean of all individual dominant frequencies.
WITH reporting, region
MATCH (e:SeismicEvent)-[:PART_OF]->(reporting)
WITH reporting, region,
     avg(e.frequency)          AS avgFreq,
     collect(e.classification) AS classifications,
     count(e)                  AS reporters

SET reporting.avgFrequency  = avgFreq,
    reporting.classification = CASE
        WHEN 'NUCLEAR_EVENT' IN classifications THEN 'NUCLEAR_EVENT'
        WHEN 'CONVENTIONAL_EXPLOSION' IN classifications THEN 'CONVENTIONAL_EXPLOSION'
        ELSE 'EARTHQUAKE'
    END

// Classification labels for Neo4j Browser visualisation
FOREACH (_ IN CASE WHEN reporting.classification = 'EARTHQUAKE'             THEN [1] ELSE [] END | SET reporting:EARTHQUAKE)
FOREACH (_ IN CASE WHEN reporting.classification = 'CONVENTIONAL_EXPLOSION' THEN [1] ELSE [] END | SET reporting:CONVENTIONAL_EXPLOSION)
FOREACH (_ IN CASE WHEN reporting.classification = 'NUCLEAR_EVENT'          THEN [1] ELSE [] END | SET reporting:NUCLEAR_EVENT)

// Majority confirmation: reporters = distinct replicas that contributed an event
WITH reporting, region, reporters
FOREACH (_ IN CASE WHEN reporters >= $majority_threshold THEN [1] ELSE [] END |
    MERGE (region)-[:CONFIRMED]->(reporting)
    SET reporting.confirmed = true
)

RETURN
    reporters                               AS reporterCount,
    (reporters = 1)                         AS isFirstReport,
    (reporters = $majority_threshold)       AS justConfirmed,
    reporting.avgFrequency                  AS avgFrequency,
    reporting.classification                AS highestClassification
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
                        logger.warning("Constraint deadlock after 3 attempts, skipping: %s", e)
                        break
                    wait = attempt * 2
                    logger.debug("Constraint deadlock (attempt %d), retrying in %ds...", attempt, wait)
                    await asyncio.sleep(wait)
                except DatabaseError as e:
                    logger.warning("Constraint creation skipped (data conflict or already exists): %s", e.message)
                    break
        logger.info("Neo4j constraints applied.")

    async def save_seismic_event(self, event: dict, timestamp: str, metadata: dict):
        """
        Persists a detected seismic event as a fully connected graph:
            (Replica)-[:DETECTED]->(SeismicEvent)-[:PART_OF]->(Reporting)-[:OCCURRED_IN]->(Region)
            (Sensor)-[:OBSERVED]->(Reporting)
            (Sensor)-[:LOCATED_IN]->(Region)

        SeismicEvent is the individual detection by THIS replica.
        Reporting is the aggregated physical event — its avgFrequency and
        classification are recomputed from all contributing SeismicEvents
        on every write.

        Returns a dict with the aggregated reporting data, or None on failure.
        """
        reporting_id = hashlib.md5(
            f"{event['sensor_id']}-{timestamp[:16]}".encode()
        ).hexdigest()
        event_id = hashlib.md5(
            f"{reporting_id}-{self._replica_id}".encode()
        ).hexdigest()

        logger.info(
            "ALERT: %s detected by %s! Frequency: %s Hz — saving to Neo4j...",
            event['event_type'], event['sensor_id'], event['dominant_frequency']
        )

        ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

        try:
            async with self._driver.session() as session:
                result = await session.run(
                    _SAVE_EVENT_QUERY,
                    event_id=event_id,
                    reporting_id=reporting_id,
                    sensor_id=event["sensor_id"],
                    timestamp=ts,
                    frequency=event["dominant_frequency"],
                    classification=event["event_type"],
                    lat=metadata.get("lat", 0.0),
                    lon=metadata.get("lon", 0.0),
                    region=metadata.get("region", "UNKNOWN"),
                    replica_id=self._replica_id,
                    majority_threshold=_MAJORITY_THRESHOLD,
                )
                record = await result.single()

            if record and record["isFirstReport"]:
                logger.info(
                    "[DB] New Reporting created: id=%s type=%s sensor=%s region=%s freq=%.2f Hz",
                    reporting_id, record["highestClassification"], event["sensor_id"],
                    metadata.get("region", "UNKNOWN"), record["avgFrequency"],
                )
            else:
                logger.info(
                    "[DB] Reporting updated: id=%s reporters=%s avgFreq=%.2f class=%s replica=%s",
                    reporting_id, record["reporterCount"] if record else "?",
                    record["avgFrequency"] if record else 0,
                    record["highestClassification"] if record else "?",
                    self._replica_id,
                )

            if record and record["justConfirmed"]:
                logger.info(
                    "[DB] Reporting CONFIRMED by majority (%d/%d replicas): id=%s type=%s region=%s",
                    record["reporterCount"], REPLICA_COUNT,
                    reporting_id, record["highestClassification"],
                    metadata.get("region", "UNKNOWN"),
                )

            if record:
                return {
                    "reporting_id": reporting_id,
                    "avg_frequency": record["avgFrequency"],
                    "classification": record["highestClassification"],
                    "reporter_count": record["reporterCount"],
                    "confirmed": record.get("justConfirmed", False),
                }
            return None
        except Exception as e:
            logger.error("Failed to save event %s to Neo4j: %s: %s", reporting_id, type(e).__name__, e)
            return None

    async def close(self):
        await self._driver.close()


async def create_repository(replica_id: str) -> "Neo4jRepository":
    """
    Factory: initialises the driver, verifies connectivity, and applies constraints.
    Retries on ServiceUnavailable (Neo4j still booting) with exponential backoff.
    """
    from neo4j.exceptions import ServiceUnavailable

    logger.info("Connecting to Neo4j at %s...", NEO4J_URI)
    repo = Neo4jRepository(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, replica_id)

    for attempt in range(1, 11):
        try:
            await repo.verify_connectivity()
            logger.info("Neo4j connection OK.")
            break
        except ServiceUnavailable as e:
            if attempt == 10:
                raise
            wait = min(attempt * 3, 20)
            logger.debug("Neo4j not ready (attempt %d/10), retrying in %ds... (%s)", attempt, wait, e)
            await asyncio.sleep(wait)

    await repo.create_constraints()
    return repo
