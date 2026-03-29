package org.example.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Node("Replica")
public class Replica {

    @Id
    private String replicaId;

    /** "connected" or "disconnected" — last known status from the broker. */
    private String status;

    /** Timestamp of the most recent status change received from the broker. */
    private ZonedDateTime lastSeen;

    /** Timestamp of the last time this replica connected. */
    private ZonedDateTime connectedSince;

    @Relationship(type = "HAD_DISCONNECTION", direction = Relationship.Direction.OUTGOING)
    private List<DisconnectionEvent> disconnections = new ArrayList<>();

    protected Replica() {}

    public Replica(String replicaId) {
        this.replicaId = replicaId;
    }

    public String getReplicaId() { return replicaId; }
    public void setReplicaId(String replicaId) { this.replicaId = replicaId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public ZonedDateTime getLastSeen() { return lastSeen; }
    public void setLastSeen(ZonedDateTime lastSeen) { this.lastSeen = lastSeen; }

    public ZonedDateTime getConnectedSince() { return connectedSince; }
    public void setConnectedSince(ZonedDateTime connectedSince) { this.connectedSince = connectedSince; }

    public List<DisconnectionEvent> getDisconnections() { return disconnections; }
    public void addDisconnection(DisconnectionEvent event) { this.disconnections.add(event); }
}
