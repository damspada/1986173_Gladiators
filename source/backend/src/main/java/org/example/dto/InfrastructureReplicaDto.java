package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record InfrastructureReplicaDto(
        String id,
        String status,
        @JsonProperty("lagMs") long lagMs
) {}
