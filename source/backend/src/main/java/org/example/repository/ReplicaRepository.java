package org.example.repository;

import org.example.model.Replica;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReplicaRepository extends Neo4jRepository<Replica, String> {

    @Query("MATCH (r:Replica) WHERE r.status = 'connected' RETURN r ORDER BY r.connectedSince DESC")
    List<Replica> findAllConnected();

    @Query("MATCH (r:Replica) RETURN r ORDER BY r.lastSeen DESC")
    List<Replica> findAllOrderByLastSeen();
}
