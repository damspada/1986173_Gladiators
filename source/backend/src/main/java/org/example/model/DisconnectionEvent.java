package org.example.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

import java.time.ZonedDateTime;
import java.util.UUID;

/**
 * Represents a single disconnection event for a replica.
 * Created whenever the broker reports a replica's status as "disconnected".
 *
 * Graph pattern: (:Replica)-[:HAD_DISCONNECTION]->(:DisconnectionEvent)
 */
@Node("DisconnectionEvent")
public class DisconnectionEvent {

    @Id
    private String id;

    /** The replica that disconnected. Stored as a scalar for easy querying. */
    private String replicaId;

    /** When the disconnection was detected (timestamp from broker message). */
    private ZonedDateTime timestamp;

    /**
     * How many seconds the replica was connected before this disconnection.
     * -1 if unknown (no connectedSince recorded for this session).
     */
    private long durationSeconds;

    protected DisconnectionEvent() {}

    public DisconnectionEvent(String replicaId, ZonedDateTime timestamp, ZonedDateTime connectedSince) {
        this.id = UUID.randomUUID().toString();
        this.replicaId = replicaId;
        this.timestamp = timestamp;
        this.durationSeconds = connectedSince != null
                ? java.time.Duration.between(connectedSince, timestamp).getSeconds()
                : -1L;
    }

    public String getId() { return id; }

    public String getReplicaId() { return replicaId; }

    public ZonedDateTime getTimestamp() { return timestamp; }

    public long getDurationSeconds() { return durationSeconds; }
}
