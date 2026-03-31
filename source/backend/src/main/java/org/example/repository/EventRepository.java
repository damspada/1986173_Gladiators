package org.example.repository;

import org.example.model.Event;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository for individual SeismicEvent detections (one per replica per physical event).
 * Most queries now target the aggregated Reporting nodes via ReportingRepository.
 */
@Repository
public interface EventRepository extends Neo4jRepository<Event, String> {
}

