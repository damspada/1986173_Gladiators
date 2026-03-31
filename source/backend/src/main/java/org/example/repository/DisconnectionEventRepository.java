package org.example.repository;

import org.example.model.DisconnectionEvent;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DisconnectionEventRepository extends Neo4jRepository<DisconnectionEvent, String> {

    /** All disconnection events for a specific replica, newest first. */
    @Query("MATCH (r:Replica {replicaId: $replicaId})-[:HAD_DISCONNECTION]->(d:DisconnectionEvent) " +
           "RETURN d ORDER BY d.timestamp DESC")
    List<DisconnectionEvent> findByReplicaId(String replicaId);

    /** All disconnection events across all replicas, newest first. */
    @Query("MATCH (r:Replica)-[:HAD_DISCONNECTION]->(d:DisconnectionEvent) " +
           "RETURN d ORDER BY d.timestamp DESC")
    List<DisconnectionEvent> findAllOrderByTimestampDesc();

    /** Paginated: all replicas, newest first. */
    @Query("MATCH (r:Replica)-[:HAD_DISCONNECTION]->(d:DisconnectionEvent) " +
           "RETURN d ORDER BY d.timestamp DESC SKIP $skip LIMIT $limit")
    List<DisconnectionEvent> findAllPaginated(int skip, int limit);

    /** Paginated: single replica, newest first. */
    @Query("MATCH (r:Replica {replicaId: $replicaId})-[:HAD_DISCONNECTION]->(d:DisconnectionEvent) " +
           "RETURN d ORDER BY d.timestamp DESC SKIP $skip LIMIT $limit")
    List<DisconnectionEvent> findByReplicaIdPaginated(String replicaId, int skip, int limit);

    /** Total count across all replicas. */
    @Query("MATCH (r:Replica)-[:HAD_DISCONNECTION]->(d:DisconnectionEvent) RETURN count(d)")
    long countAll();

    /** Total count for a specific replica. */
    @Query("MATCH (r:Replica {replicaId: $replicaId})-[:HAD_DISCONNECTION]->(d:DisconnectionEvent) RETURN count(d)")
    long countByReplicaId(String replicaId);
}
