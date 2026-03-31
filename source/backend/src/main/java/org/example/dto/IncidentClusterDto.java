package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Represents a cluster of closely-timed seismic events in the same region.
 * Produced by the backend incident-grouping aggregation query.
 */
public record IncidentClusterDto(
        String id,
        String region,
        String severity,
        @JsonProperty("from") String fromTimestamp,
        @JsonProperty("to")   String toTimestamp,
        @JsonProperty("cluster_time") String clusterTime,
        int count,
        @JsonProperty("peak_frequency") double peakFrequency,
        @JsonProperty("confirmed_count") int confirmedCount,
        List<SeismicEventDto> events
) {}
