package org.example.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record InfrastructureStatusDto(
        String gateway,
        List<InfrastructureReplicaDto> replicas,
        @JsonProperty("activeReplica") String activeReplica,
        @JsonProperty("lastFailoverAt") String lastFailoverAt
) {}
