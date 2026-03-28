package org.example.repository;

import org.example.model.Event;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface EventRepository extends Neo4jRepository<Event, String> {

    Optional<Event> findByEventId(String eventId);

    boolean existsBySensorIdAndTimestampAndFrequency(String sensorId, Instant timestamp, double frequency);

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
}
