package org.example.controller;

import org.example.dto.DisconnectionEventDto;
import org.example.dto.ReplicaStatusDto;
import org.example.repository.DisconnectionEventRepository;
import org.example.repository.ReplicaRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/replicas")
public class ReplicaController {

    private final ReplicaRepository replicaRepository;
    private final DisconnectionEventRepository disconnectionEventRepository;

    public ReplicaController(ReplicaRepository replicaRepository,
                             DisconnectionEventRepository disconnectionEventRepository) {
        this.replicaRepository = replicaRepository;
        this.disconnectionEventRepository = disconnectionEventRepository;
    }

    /** All replicas ever seen, ordered by most recently active. */
    @GetMapping
    public List<ReplicaStatusDto> getAllReplicas() {
        return replicaRepository.findAllOrderByLastSeen()
                .stream()
                .map(ReplicaStatusDto::from)
                .toList();
    }

    /** Only replicas currently connected to the broker. */
    @GetMapping("/connected")
    public List<ReplicaStatusDto> getConnectedReplicas() {
        return replicaRepository.findAllConnected()
                .stream()
                .map(ReplicaStatusDto::from)
                .toList();
    }

    /** A single replica by its ID. */
    @GetMapping("/{replicaId}")
    public ReplicaStatusDto getReplica(@PathVariable String replicaId) {
        return replicaRepository.findById(replicaId)
                .map(ReplicaStatusDto::from)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND,
                        "Replica not found: " + replicaId));
    }

    /** All disconnection events across all replicas, newest first. */
    @GetMapping("/disconnections")
    public List<DisconnectionEventDto> getAllDisconnections() {
        return disconnectionEventRepository.findAllOrderByTimestampDesc()
                .stream()
                .map(DisconnectionEventDto::from)
                .toList();
    }

    /** Disconnection history for a specific replica, newest first. */
    @GetMapping("/{replicaId}/disconnections")
    public List<DisconnectionEventDto> getDisconnectionsForReplica(@PathVariable String replicaId) {
        if (!replicaRepository.existsById(replicaId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND,
                    "Replica not found: " + replicaId);
        }
        return disconnectionEventRepository.findByReplicaId(replicaId)
                .stream()
                .map(DisconnectionEventDto::from)
                .toList();
    }
}
