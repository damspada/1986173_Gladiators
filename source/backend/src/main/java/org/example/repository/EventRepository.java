package org.example.repository;

import org.example.model.Event;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface EventRepository extends Neo4jRepository<Event, String> {

    // ── Scalar-property filter query (fast path, no relationship traversal needed) ─
    @Query("""
            MATCH (e:SeismicEvent)
            WHERE ($classification IS NULL OR e.classification = $classification)
              AND ($sensorId IS NULL OR toLower(e.sensorId) CONTAINS toLower($sensorId))
              AND ($region IS NULL OR toLower(e.region) CONTAINS toLower($region))
              AND ($from IS NULL OR e.timestamp >= $from)
              AND ($to IS NULL OR e.timestamp <= $to)
            RETURN e ORDER BY e.timestamp DESC
            """)
    List<Event> findByFilters(
            @Param("classification") String classification,
            @Param("sensorId") String sensorId,
            @Param("region") String region,
            @Param("from") Instant from,
            @Param("to") Instant to
    );

    // ── Confirmed events (majority of replicas agreed) ───────────────────────
    @Query("""
            MATCH (e:SeismicEvent)
            WHERE e.confirmed = true
            RETURN e ORDER BY e.timestamp DESC
            """)
    List<Event> findAllConfirmed();

    // ── Events that have been reported by at least minReporters replicas ─────
    @Query("""
            MATCH (e:SeismicEvent)
            MATCH (rep:Replica)-[:REPORTED]->(e)
            WITH e, count(rep) AS reporters
            WHERE reporters >= $minReporters
            RETURN e ORDER BY reporters DESC, e.timestamp DESC
            """)
    List<Event> findCorroborated(@Param("minReporters") int minReporters);
}

