package org.example.service;

import org.example.dto.CorroborationDto;
import org.example.dto.HistoryPageDto;
import org.example.dto.IncidentClusterDto;
import org.example.dto.SeismicEventDto;
import org.example.model.Classification;
import org.example.model.Event;
import org.example.repository.EventRepository;
import org.example.websocket.SeismicWebSocketHandler;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
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

    /**
     * Returns corroboration data for a single event by its ID.
     * Includes which replicas reported it, their detection timestamps, and confirmation status.
     */
    @Transactional(readOnly = true)
    public CorroborationDto findCorroborationById(String eventId) {
        String cypher = """
                MATCH (e:SeismicEvent {eventId: $eventId})
                OPTIONAL MATCH (rep:Replica)-[r:REPORTED]->(e)
                WITH e, collect({replicaId: rep.replicaId, detectedAt: r.detectedAt}) AS reporters
                RETURN e.eventId        AS eventId,
                       e.classification AS classification,
                       e.region         AS region,
                       e.confirmed      AS confirmed,
                       size(reporters)  AS reporterCount,
                       [x IN reporters | x.replicaId]  AS replicaIds,
                       [x IN reporters | toString(x.detectedAt)] AS detectedAts
                """;

        return neo4jClient.query(cypher)
                .bindAll(java.util.Map.of("eventId", eventId))
                .fetchAs(CorroborationDto.class)
                .mappedBy((typeSystem, record) -> new CorroborationDto(
                        record.get("eventId").asString(null),
                        record.get("classification").asString(null),
                        record.get("region").asString(null),
                        record.get("confirmed").asBoolean(false),
                        record.get("reporterCount").asInt(0),
                        record.get("replicaIds").asList(v -> v.asString()),
                        record.get("detectedAts").asList(v -> v.asString())
                ))
                .one()
                .orElse(null);
    }

    /**
     * Groups events into incident clusters: events in the same region within
     * {@code windowMinutes} of each other belong to the same cluster.
     * Performed via a single Cypher query that returns events ordered by region
     * and timestamp, then clustered in Java.
     */
    @Transactional(readOnly = true)
    public List<IncidentClusterDto> findIncidentClusters(int windowMinutes,
                                                          Instant from, Instant to) {
        String classification = null;
        List<Event> events = (from != null || to != null)
                ? eventRepository.findByFilters(classification, null, null, from, to)
                : eventRepository.findByFilters(classification, null, null, null, null);

        // Sort by region, then by timestamp
        events.sort((a, b) -> {
            int regionCmp = safeRegion(a).compareTo(safeRegion(b));
            if (regionCmp != 0) return regionCmp;
            return a.getTimestamp().compareTo(b.getTimestamp());
        });

        Duration window = Duration.ofMinutes(windowMinutes);
        List<IncidentClusterDto> clusters = new ArrayList<>();
        List<Event> currentGroup = new ArrayList<>();
        String currentRegion = null;

        for (Event event : events) {
            String region = safeRegion(event);
            if (currentRegion == null) {
                currentRegion = region;
                currentGroup.add(event);
                continue;
            }

            Event last = currentGroup.get(currentGroup.size() - 1);
            boolean sameRegion = region.equals(currentRegion);
            boolean withinWindow = sameRegion &&
                    Duration.between(last.getTimestamp(), event.getTimestamp()).abs()
                            .compareTo(window) <= 0;

            if (sameRegion && withinWindow) {
                currentGroup.add(event);
            } else {
                clusters.add(buildCluster(currentGroup, currentRegion));
                currentGroup = new ArrayList<>();
                currentGroup.add(event);
                currentRegion = region;
            }
        }

        if (!currentGroup.isEmpty()) {
            clusters.add(buildCluster(currentGroup, currentRegion));
        }

        // Sort clusters newest-first
        clusters.sort((a, b) -> b.toTimestamp().compareTo(a.toTimestamp()));
        return clusters;
    }

    private static String safeRegion(Event e) {
        return e.getRegion() != null ? e.getRegion() : "UNKNOWN";
    }

    private static IncidentClusterDto buildCluster(List<Event> group, String region) {
        Event first = group.get(0);
        Event last = group.get(group.size() - 1);

        // Severity = highest classification in the group
        Classification severity = group.stream()
                .map(Event::getClassification)
                .max((a, b) -> Integer.compare(a.ordinal(), b.ordinal()))
                .orElse(Classification.EARTHQUAKE);

        double peakFreq = group.stream()
                .mapToDouble(Event::getFrequency)
                .max()
                .orElse(0.0);

        int confirmedCount = (int) group.stream().filter(Event::isConfirmed).count();

        String id = region + "-" + first.getTimestamp().toInstant().toString();

        List<SeismicEventDto> eventDtos = group.stream()
                .map(SeismicEventDto::forHistory)
                .toList();

        return new IncidentClusterDto(
                id,
                region,
                severity.name(),
                first.getTimestamp().toInstant().toString(),
                last.getTimestamp().toInstant().toString(),
                group.size(),
                peakFreq,
                confirmedCount,
                eventDtos
        );
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

