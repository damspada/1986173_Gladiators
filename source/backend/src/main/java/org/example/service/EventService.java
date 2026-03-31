package org.example.service;

import org.example.dto.CorroborationDto;
import org.example.dto.HistoryPageDto;
import org.example.dto.IncidentClusterDto;
import org.example.dto.SeismicEventDto;
import org.example.model.Classification;
import org.example.model.Reporting;
import org.example.repository.ReportingRepository;
import org.example.websocket.SeismicWebSocketHandler;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class EventService {

    private final ReportingRepository reportingRepository;
    private final SeismicWebSocketHandler webSocketHandler;
    private final Neo4jClient neo4jClient;

    public EventService(ReportingRepository reportingRepository,
                        SeismicWebSocketHandler webSocketHandler,
                        Neo4jClient neo4jClient) {
        this.reportingRepository = reportingRepository;
        this.webSocketHandler = webSocketHandler;
        this.neo4jClient = neo4jClient;
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SeismicEventDto> findByFilters(Classification type, String sensorId,
                                               String region, Instant from, Instant to) {
        String classification = type != null ? type.name() : null;
        return reportingRepository.findByFilters(classification, sensorId, region, from, to)
                .stream()
                .map(SeismicEventDto::fromReporting)
                .toList();
    }

    @Transactional(readOnly = true)
    public HistoryPageDto findByFiltersPaged(Classification type, String sensorId,
                                             String region, Instant from, Instant to,
                                             int offset, int limit) {
        String classification = type != null ? type.name() : null;
        long total = reportingRepository.countByFilters(classification, sensorId, region, from, to);
        List<SeismicEventDto> events = reportingRepository
                .findByFiltersPaged(classification, sensorId, region, from, to, offset, limit)
                .stream()
                .map(SeismicEventDto::fromReporting)
                .toList();
        return new HistoryPageDto(events, total, limit, offset);
    }

    @Transactional(readOnly = true)
    public List<SeismicEventDto> findConfirmedEvents() {
        return reportingRepository.findAllConfirmed()
                .stream()
                .map(SeismicEventDto::fromReporting)
                .toList();
    }

    /**
     * Returns per-reporting corroboration data: how many replicas contributed
     * individual events, their frequencies and classifications.
     */
    @Transactional(readOnly = true)
    public List<CorroborationDto> findCorroboration() {
        String cypher = """
                MATCH (r:Reporting)
                OPTIONAL MATCH (e:SeismicEvent)-[:PART_OF]->(r)
                WITH r,
                     collect(e.replicaId)      AS replicaIds,
                     collect(e.frequency)      AS frequencies,
                     collect(e.classification) AS classifications
                RETURN r.reportingId       AS eventId,
                       r.classification    AS classification,
                       r.avgFrequency      AS avgFrequency,
                       r.region            AS region,
                       r.confirmed         AS confirmed,
                       size(replicaIds)    AS reporterCount,
                       replicaIds,
                       frequencies,
                       classifications
                ORDER BY reporterCount DESC, r.timestamp DESC
                """;

        return neo4jClient.query(cypher)
                .fetchAs(CorroborationDto.class)
                .mappedBy((typeSystem, record) -> new CorroborationDto(
                        record.get("eventId").asString(null),
                        record.get("classification").asString(null),
                        record.get("avgFrequency").asDouble(0.0),
                        record.get("region").asString(null),
                        record.get("confirmed").asBoolean(false),
                        record.get("reporterCount").asInt(0),
                        record.get("replicaIds").asList(v -> v.asString()),
                        record.get("frequencies").asList(v -> v.asDouble()),
                        record.get("classifications").asList(v -> v.asString())
                ))
                .all()
                .stream()
                .toList();
    }

    /**
     * Returns corroboration data for a single reporting by its ID.
     * Shows individual event frequencies and classifications from each replica.
     */
    @Transactional(readOnly = true)
    public CorroborationDto findCorroborationById(String reportingId) {
        String cypher = """
                MATCH (r:Reporting {reportingId: $reportingId})
                OPTIONAL MATCH (e:SeismicEvent)-[:PART_OF]->(r)
                WITH r,
                     collect({replicaId: e.replicaId, frequency: e.frequency,
                              classification: e.classification, detectedAt: e.timestamp}) AS events
                RETURN r.reportingId       AS eventId,
                       r.classification    AS classification,
                       r.avgFrequency      AS avgFrequency,
                       r.region            AS region,
                       r.confirmed         AS confirmed,
                       size(events)        AS reporterCount,
                       [x IN events | x.replicaId]       AS replicaIds,
                       [x IN events | x.frequency]       AS frequencies,
                       [x IN events | x.classification]  AS classifications,
                       [x IN events | toString(x.detectedAt)] AS detectedAts
                """;

        return neo4jClient.query(cypher)
                .bindAll(java.util.Map.of("reportingId", reportingId))
                .fetchAs(CorroborationDto.class)
                .mappedBy((typeSystem, record) -> new CorroborationDto(
                        record.get("eventId").asString(null),
                        record.get("classification").asString(null),
                        record.get("avgFrequency").asDouble(0.0),
                        record.get("region").asString(null),
                        record.get("confirmed").asBoolean(false),
                        record.get("reporterCount").asInt(0),
                        record.get("replicaIds").asList(v -> v.asString()),
                        record.get("frequencies").asList(v -> v.asDouble()),
                        record.get("classifications").asList(v -> v.asString()),
                        record.get("detectedAts").asList(v -> v.asString())
                ))
                .one()
                .orElse(null);
    }

    /**
     * Groups reportings into incident clusters: reportings in the same region within
     * {@code windowMinutes} of each other belong to the same cluster.
     */
    @Transactional(readOnly = true)
    public List<IncidentClusterDto> findIncidentClusters(int windowMinutes,
                                                          Instant from, Instant to) {
        String classification = null;
        List<Reporting> reportings = (from != null || to != null)
                ? reportingRepository.findByFilters(classification, null, null, from, to)
                : reportingRepository.findByFilters(classification, null, null, null, null);

        reportings.sort((a, b) -> {
            int regionCmp = safeRegion(a).compareTo(safeRegion(b));
            if (regionCmp != 0) return regionCmp;
            return a.getTimestamp().compareTo(b.getTimestamp());
        });

        Duration window = Duration.ofMinutes(windowMinutes);
        List<IncidentClusterDto> clusters = new ArrayList<>();
        List<Reporting> currentGroup = new ArrayList<>();
        String currentRegion = null;

        for (Reporting r : reportings) {
            String region = safeRegion(r);
            if (currentRegion == null) {
                currentRegion = region;
                currentGroup.add(r);
                continue;
            }

            Reporting last = currentGroup.get(currentGroup.size() - 1);
            boolean sameRegion = region.equals(currentRegion);
            boolean withinWindow = sameRegion &&
                    Duration.between(last.getTimestamp(), r.getTimestamp()).abs()
                            .compareTo(window) <= 0;

            if (sameRegion && withinWindow) {
                currentGroup.add(r);
            } else {
                clusters.add(buildCluster(currentGroup, currentRegion));
                currentGroup = new ArrayList<>();
                currentGroup.add(r);
                currentRegion = region;
            }
        }

        if (!currentGroup.isEmpty()) {
            clusters.add(buildCluster(currentGroup, currentRegion));
        }

        clusters.sort((a, b) -> b.toTimestamp().compareTo(a.toTimestamp()));
        return clusters;
    }

    private static String safeRegion(Reporting r) {
        return r.getRegion() != null ? r.getRegion() : "UNKNOWN";
    }

    private static IncidentClusterDto buildCluster(List<Reporting> group, String region) {
        Reporting first = group.get(0);
        Reporting last = group.get(group.size() - 1);

        Classification severity = group.stream()
                .map(r -> {
                    try { return Classification.valueOf(r.getClassification()); }
                    catch (Exception e) { return Classification.EARTHQUAKE; }
                })
                .max((a, b) -> Integer.compare(a.ordinal(), b.ordinal()))
                .orElse(Classification.EARTHQUAKE);

        double peakFreq = group.stream()
                .mapToDouble(Reporting::getAvgFrequency)
                .max()
                .orElse(0.0);

        int confirmedCount = (int) group.stream().filter(Reporting::isConfirmed).count();

        String id = region + "-" + first.getTimestamp().toInstant().toString();

        List<SeismicEventDto> eventDtos = group.stream()
                .map(SeismicEventDto::fromReporting)
                .toList();

        String fromTs = first.getTimestamp().toInstant().toString();

        return new IncidentClusterDto(
                id,
                region,
                severity.name(),
                fromTs,
                last.getTimestamp().toInstant().toString(),
                fromTs,
                group.size(),
                peakFreq,
                confirmedCount,
                eventDtos
        );
    }

    // ── Broadcast ────────────────────────────────────────────────────────────

    public void broadcast(SeismicEventDto dto) {
        webSocketHandler.broadcast(dto);
    }
}

