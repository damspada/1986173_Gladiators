package org.example.service;

import org.example.dto.CorroborationDto;
import org.example.dto.HistoryPageDto;
import org.example.dto.SeismicEventDto;
import org.example.model.Classification;
import org.example.model.Event;
import org.example.repository.EventRepository;
import org.example.websocket.SeismicWebSocketHandler;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Transactional
public class EventService {

    private final EventRepository eventRepository;
    private final SeismicWebSocketHandler webSocketHandler;
    private final Neo4jClient neo4jClient;

    public EventService(EventRepository eventRepository,
                        SeismicWebSocketHandler webSocketHandler,
                        Neo4jClient neo4jClient) {
        this.eventRepository = eventRepository;
        this.webSocketHandler = webSocketHandler;
        this.neo4jClient = neo4jClient;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SeismicEventDto> findByFilters(Classification type, String sensorId,
                                               String region, Instant from, Instant to) {
        String classification = type != null ? type.name() : null;
        return eventRepository.findByFilters(classification, sensorId, region, from, to)
                .stream()
                .map(SeismicEventDto::forHistory)
                .toList();
    }

    @Transactional(readOnly = true)
    public HistoryPageDto findByFiltersPaged(Classification type, String sensorId,
                                             String region, Instant from, Instant to,
                                             int offset, int limit) {
        String classification = type != null ? type.name() : null;
        long total = eventRepository.countByFilters(classification, sensorId, region, from, to);
        List<SeismicEventDto> events = eventRepository
                .findByFiltersPaged(classification, sensorId, region, from, to, offset, limit)
                .stream()
                .map(SeismicEventDto::forHistory)
                .toList();
        return new HistoryPageDto(events, total, limit, offset);
    }

    @Transactional(readOnly = true)
    public List<SeismicEventDto> findConfirmedEvents() {
        return eventRepository.findAllConfirmed()
                .stream()
                .map(SeismicEventDto::forHistory)
                .toList();
    }

    /**
     * Returns per-event corroboration data: how many replicas reported each event
     * and which replica IDs they were. Uses Neo4jClient for the aggregation query
     * since it returns multi-column results that don't map to a single entity.
     */
    @Transactional(readOnly = true)
    public List<CorroborationDto> findCorroboration() {
        String cypher = """
                MATCH (e:SeismicEvent)
                OPTIONAL MATCH (rep:Replica)-[:REPORTED]->(e)
                WITH e, collect(rep.replicaId) AS replicaIds
                RETURN e.eventId        AS eventId,
                       e.classification AS classification,
                       e.region         AS region,
                       e.confirmed      AS confirmed,
                       size(replicaIds) AS reporterCount,
                       replicaIds
                ORDER BY reporterCount DESC, e.timestamp DESC
                """;

        return neo4jClient.query(cypher)
                .fetchAs(CorroborationDto.class)
                .mappedBy((typeSystem, record) -> new CorroborationDto(
                        record.get("eventId").asString(null),
                        record.get("classification").asString(null),
                        record.get("region").asString(null),
                        record.get("confirmed").asBoolean(false),
                        record.get("reporterCount").asInt(0),
                        record.get("replicaIds").asList(v -> v.asString())
                ))
                .all()
                .stream()
                .toList();
    }

    // ── Write ────────────────────────────────────────────────────────────────

    public Event save(Event event) {
        // eventId is deterministic (MD5 by replicas) — skip Neo4j write if already persisted,
        // but always broadcast so the first replica's notification reaches the WebSocket clients.
        if (event.getEventId() != null && eventRepository.existsById(event.getEventId())) {
            webSocketHandler.broadcast(SeismicEventDto.forRealtime(event));
            return event;
        }
        Event saved = eventRepository.save(event);
        webSocketHandler.broadcast(SeismicEventDto.forRealtime(saved));
        return saved;
    }
}

