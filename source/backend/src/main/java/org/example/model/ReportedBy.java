package org.example.model;

import org.springframework.data.neo4j.core.schema.RelationshipId;
import org.springframework.data.neo4j.core.schema.RelationshipProperties;
import org.springframework.data.neo4j.core.schema.TargetNode;

import java.time.ZonedDateTime;

/**
 * Models the (:Replica)-[:REPORTED {detectedAt}]->(:SeismicEvent) relationship.
 * Each instance represents one replica's corroboration of a seismic event,
 * including when that replica detected it.
 */
@RelationshipProperties
public class ReportedBy {

    @RelationshipId
    private Long id;

    @TargetNode
    private Replica replica;

    private ZonedDateTime detectedAt;

    protected ReportedBy() {}

    public ReportedBy(Replica replica, ZonedDateTime detectedAt) {
        this.replica = replica;
        this.detectedAt = detectedAt;
    }

    public Long getId() { return id; }
    public Replica getReplica() { return replica; }
    public ZonedDateTime getDetectedAt() { return detectedAt; }
}
