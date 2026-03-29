package org.example.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.example.model.Classification;
import org.example.model.Event;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SeismicEventDto(
        @JsonProperty("event_id")   String eventId,
        @JsonProperty("sensor_id")  String sensorId,
        String timestamp,
        double frequency,
        Classification classification,
        boolean confirmed,
        double lat,
        @JsonProperty("long") double lon,
        String region,
        SensorMetaDto sensor
) {
    public static SeismicEventDto forRealtime(Event e) {
        return new SeismicEventDto(
                e.getEventId(),
                e.getSensorId(),
                e.getTimestamp() != null ? e.getTimestamp().toInstant().toString() : null,
                e.getFrequency(),
                e.getClassification(),
                e.isConfirmed(),
                e.getLat(),
                e.getLon(),
                e.getRegion(),
                null
        );
    }

    public static SeismicEventDto forHistory(Event e) {
        return new SeismicEventDto(
                e.getEventId(),
                e.getSensorId(),
                e.getTimestamp() != null ? e.getTimestamp().toInstant().toString() : null,
                e.getFrequency(),
                e.getClassification(),
                e.isConfirmed(),
                e.getLat(),
                e.getLon(),
                e.getRegion(),
                new SensorMetaDto(e.getSensorId(), e.getLat(), e.getLon(), e.getRegion())
        );
    }
}


