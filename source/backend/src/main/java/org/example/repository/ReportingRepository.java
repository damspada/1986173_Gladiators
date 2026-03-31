package org.example.repository;

import org.example.model.Reporting;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ReportingRepository extends Neo4jRepository<Reporting, String> {

    @Query("""
            MATCH (r:Reporting)
            WHERE ($classification IS NULL OR r.classification = $classification)
              AND ($sensorId IS NULL OR toLower(r.sensorId) CONTAINS toLower($sensorId))
              AND ($region IS NULL OR toLower(r.region) CONTAINS toLower($region))
              AND ($from IS NULL OR r.timestamp >= $from)
              AND ($to IS NULL OR r.timestamp <= $to)
            RETURN r ORDER BY r.timestamp DESC
            """)
    List<Reporting> findByFilters(
            @Param("classification") String classification,
            @Param("sensorId") String sensorId,
            @Param("region") String region,
            @Param("from") Instant from,
            @Param("to") Instant to
    );

    @Query("""
            MATCH (r:Reporting)
            WHERE ($classification IS NULL OR r.classification = $classification)
              AND ($sensorId IS NULL OR toLower(r.sensorId) CONTAINS toLower($sensorId))
              AND ($region IS NULL OR toLower(r.region) CONTAINS toLower($region))
              AND ($from IS NULL OR r.timestamp >= $from)
              AND ($to IS NULL OR r.timestamp <= $to)
            RETURN r ORDER BY r.timestamp DESC
            SKIP $offset LIMIT $limit
            """)
    List<Reporting> findByFiltersPaged(
            @Param("classification") String classification,
            @Param("sensorId") String sensorId,
            @Param("region") String region,
            @Param("from") Instant from,
            @Param("to") Instant to,
            @Param("offset") int offset,
            @Param("limit") int limit
    );

    @Query("""
            MATCH (r:Reporting)
            WHERE ($classification IS NULL OR r.classification = $classification)
              AND ($sensorId IS NULL OR toLower(r.sensorId) CONTAINS toLower($sensorId))
              AND ($region IS NULL OR toLower(r.region) CONTAINS toLower($region))
              AND ($from IS NULL OR r.timestamp >= $from)
              AND ($to IS NULL OR r.timestamp <= $to)
            RETURN count(r)
            """)
    long countByFilters(
            @Param("classification") String classification,
            @Param("sensorId") String sensorId,
            @Param("region") String region,
            @Param("from") Instant from,
            @Param("to") Instant to
    );

    @Query("""
            MATCH (r:Reporting)
            WHERE r.confirmed = true
            RETURN r ORDER BY r.timestamp DESC
            """)
    List<Reporting> findAllConfirmed();

    @Query("""
            MATCH (r:Reporting)
            MATCH (e:SeismicEvent)-[:PART_OF]->(r)
            WITH r, count(e) AS reporters
            WHERE reporters >= $minReporters
            RETURN r ORDER BY reporters DESC, r.timestamp DESC
            """)
    List<Reporting> findCorroborated(@Param("minReporters") int minReporters);
}
