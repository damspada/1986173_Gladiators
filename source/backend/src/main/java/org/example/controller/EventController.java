package org.example.controller;

import org.example.dto.CorroborationDto;
import org.example.dto.HistoryPageDto;
import org.example.dto.SeismicEventDto;
import org.example.model.Classification;
import org.example.service.EventService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/history")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    /** All events, optionally filtered. Supports server-side pagination via limit/offset. */
    @GetMapping("/events")
    public ResponseEntity<?> getHistory(
            @RequestParam(required = false) Classification type,
            @RequestParam(value = "sensor_id", required = false) String sensorId,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset) {

        if (limit != null) {
            int effectiveOffset = offset != null ? offset : 0;
            int effectiveLimit = Math.max(1, Math.min(limit, 1000));
            HistoryPageDto page = eventService.findByFiltersPaged(
                    type, sensorId, region, from, to, effectiveOffset, effectiveLimit);
            return ResponseEntity.ok(page);
        }

        return ResponseEntity.ok(eventService.findByFilters(type, sensorId, region, from, to));
    }

    /** Only events that reached the majority-replica confirmation threshold. */
    @GetMapping("/events/confirmed")
    public List<SeismicEventDto> getConfirmedEvents() {
        return eventService.findConfirmedEvents();
    }

    /**
     * Corroboration summary: for every event shows how many replicas reported it
     * and which replica IDs they were.
     */
    @GetMapping("/events/corroboration")
    public List<CorroborationDto> getCorroboration() {
        return eventService.findCorroboration();
    }
}

