package org.example.dto;

import java.util.List;

public record DisconnectionPageDto(
        List<DisconnectionEventDto> events,
        long total,
        int page,
        int size
) {}
