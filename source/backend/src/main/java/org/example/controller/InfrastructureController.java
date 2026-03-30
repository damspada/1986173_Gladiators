package org.example.controller;

import org.example.dto.InfrastructureReplicaDto;
import org.example.dto.InfrastructureStatusDto;
import org.example.model.Replica;
import org.example.repository.DisconnectionEventRepository;
import org.example.repository.ReplicaRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/infrastructure")
public class InfrastructureController {

    private final ReplicaRepository replicaRepository;
    private final DisconnectionEventRepository disconnectionEventRepository;

    public InfrastructureController(ReplicaRepository replicaRepository,
                                    DisconnectionEventRepository disconnectionEventRepository) {
        this.replicaRepository = replicaRepository;
        this.disconnectionEventRepository = disconnectionEventRepository;
    }

    @GetMapping("/status")
    public InfrastructureStatusDto getStatus() {
        List<Replica> allReplicas = replicaRepository.findAllOrderByLastSeen();

        List<InfrastructureReplicaDto> replicaDtos = allReplicas.stream()
                .map(r -> new InfrastructureReplicaDto(
                        r.getReplicaId(),
                "connected".equals(r.getStatus()) ? "healthy" : "down"
                ))
                .toList();

        long connectedCount = allReplicas.stream()
                .filter(r -> "connected".equals(r.getStatus()))
                .count();

        String gateway;
        if (allReplicas.isEmpty() || connectedCount == 0) {
            gateway = "down";
        } else if (connectedCount == allReplicas.size()) {
            gateway = "healthy";
        } else {
            gateway = "degraded";
        }

        String activeReplica = allReplicas.stream()
                .filter(r -> "connected".equals(r.getStatus()))
                .map(Replica::getReplicaId)
                .findFirst()
                .orElse(null);

        String lastFailoverAt = disconnectionEventRepository.findAllOrderByTimestampDesc()
                .stream()
                .findFirst()
                .map(d -> d.getTimestamp() != null ? d.getTimestamp().toInstant().toString() : null)
                .orElse(null);

        return new InfrastructureStatusDto(gateway, replicaDtos, activeReplica, lastFailoverAt);
    }
}
