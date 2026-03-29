package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Summarises how many replicas independently reported a seismic event
 * and whether the event reached the majority-confirmation threshold.
 */
public record CorroborationDto(
        @JsonProperty("event_id")      String eventId,
        String classification,
        String region,
        boolean confirmed,
        @JsonProperty("reporter_count") int reporterCount,
        @JsonProperty("replica_ids")   List<String> replicaIds,
        @JsonProperty("detected_ats")  List<String> detectedAts
) {
    /** Backwards-compatible constructor for callers that don't supply detectedAts. */
    public CorroborationDto(String eventId, String classification, String region,
                            boolean confirmed, int reporterCount, List<String> replicaIds) {
        this(eventId, classification, region, confirmed, reporterCount, replicaIds, List.of());
    }
}
