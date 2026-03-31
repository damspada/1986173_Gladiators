package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SimulatorEventDto(
        @JsonProperty("event_id")  String eventId,
        @JsonProperty("sensor_id") String sensorId,
        String timestamp,
        double frequency,
        double amplitude,
        String classification,
        double lat,
        @JsonProperty("long") double lon,
        String region
) {}

