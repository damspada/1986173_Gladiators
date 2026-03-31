package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.example.model.DisconnectionEvent;

public record DisconnectionEventDto(
        String id,
        @JsonProperty("replica_id")       String replicaId,
        String timestamp,
        @JsonProperty("duration_seconds") long durationSeconds
) {
    public static DisconnectionEventDto from(DisconnectionEvent d) {
        return new DisconnectionEventDto(
                d.getId(),
                d.getReplicaId(),
                d.getTimestamp() != null ? d.getTimestamp().toInstant().toString() : null,
                d.getDurationSeconds()
        );
    }
}
