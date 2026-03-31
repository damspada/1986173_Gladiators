package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record SensorMetaDto(
        @JsonProperty("sensor_id") String sensorId,
        double lat,
        @JsonProperty("long") double lon,
        String region
) {}

