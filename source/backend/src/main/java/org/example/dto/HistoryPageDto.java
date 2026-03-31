package org.example.dto;

import java.util.List;

public record HistoryPageDto(
        List<SeismicEventDto> events,
        long total,
        int limit,
        int offset
) {}
