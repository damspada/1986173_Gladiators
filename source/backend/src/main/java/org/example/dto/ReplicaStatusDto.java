package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.example.model.Replica;

/**
 * Public representation of a replica's availability status.
 * Mirrors the ReplicaStatusEvent sent by the Go broker over WebSocket.
 */
public record ReplicaStatusDto(
        @JsonProperty("replica_id")       String replicaId,
        String status,
        @JsonProperty("last_seen")        String lastSeen,
        @JsonProperty("connected_since")  String connectedSince
) {
    public static ReplicaStatusDto from(Replica r) {
        return new ReplicaStatusDto(
                r.getReplicaId(),
                r.getStatus(),
                r.getLastSeen() != null ? r.getLastSeen().toInstant().toString() : null,
                r.getConnectedSince() != null ? r.getConnectedSince().toInstant().toString() : null
        );
    }
}
