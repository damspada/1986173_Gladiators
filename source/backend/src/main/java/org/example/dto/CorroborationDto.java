package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Summarises how many replicas independently reported a seismic event
 * and whether the event reached the majority-confirmation threshold.
 * Now includes per-replica frequencies and classifications for full transparency.
 */
public record CorroborationDto(
        @JsonProperty("event_id")          String eventId,
        String classification,
        @JsonProperty("avg_frequency")     double avgFrequency,
        String region,
        boolean confirmed,
        @JsonProperty("reporter_count")    int reporterCount,
        @JsonProperty("replica_ids")       List<String> replicaIds,
        List<Double> frequencies,
        List<String> classifications,
        @JsonProperty("detected_ats")      List<String> detectedAts
) {
    /** Constructor without detectedAts (list queries). */
    public CorroborationDto(String eventId, String classification, double avgFrequency,
                            String region, boolean confirmed, int reporterCount,
                            List<String> replicaIds, List<Double> frequencies,
                            List<String> classifications) {
        this(eventId, classification, avgFrequency, region, confirmed, reporterCount,
             replicaIds, frequencies, classifications, List.of());
    }
}
