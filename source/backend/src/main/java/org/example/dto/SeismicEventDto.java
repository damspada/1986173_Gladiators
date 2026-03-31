package org.example.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.example.model.Classification;
import org.example.model.Reporting;

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
    public static SeismicEventDto fromReporting(Reporting r) {
        Classification cls = null;
        try { cls = Classification.valueOf(r.getClassification()); } catch (Exception ignored) {}
        return new SeismicEventDto(
                r.getReportingId(),
                r.getSensorId(),
                r.getTimestamp() != null ? r.getTimestamp().toInstant().toString() : null,
                r.getAvgFrequency(),
                cls,
                r.isConfirmed(),
                r.getLat(),
                r.getLon(),
                r.getRegion(),
                new SensorMetaDto(r.getSensorId(), r.getLat(), r.getLon(), r.getRegion())
        );
    }

    public static SeismicEventDto forBroadcast(ReplicaEventDto dto) {
        Classification cls = null;
        try { cls = Classification.valueOf(dto.type()); } catch (Exception ignored) {}
        return new SeismicEventDto(
                dto.eventId(),
                dto.sensorId(),
                dto.timestamp(),
                dto.frequency(),
                cls,
                false,
                dto.lat(),
                dto.lon(),
                dto.region(),
                null
        );
    }
}

