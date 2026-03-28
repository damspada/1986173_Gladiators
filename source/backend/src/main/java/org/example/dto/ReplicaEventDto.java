package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ReplicaEventDto(
        @JsonProperty("event_id") String eventId,
        @JsonProperty("sensor_id") String sensorId,
        String type,
        double frequency,
        String timestamp,
        @JsonProperty("window_size_sec") int windowSizeSec,
        double lat,
        double lon,
        String region
) {}
