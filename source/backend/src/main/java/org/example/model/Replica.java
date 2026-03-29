package org.example.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("Replica")
public class Replica {

    @Id
    private String replicaId;

    protected Replica() {}

    public Replica(String replicaId) {
        this.replicaId = replicaId;
    }

    public String getReplicaId() { return replicaId; }
    public void setReplicaId(String replicaId) { this.replicaId = replicaId; }
}
