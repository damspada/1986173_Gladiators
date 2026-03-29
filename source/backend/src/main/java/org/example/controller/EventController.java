package org.example.controller;

import org.example.dto.CorroborationDto;
import org.example.dto.SeismicEventDto;
import org.example.model.Classification;
import org.example.service.EventService;
import org.springframework.format.annotation.DateTimeFormat;
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

    /** All events, optionally filtered by classification, sensor, region, and time range. */
    @GetMapping("/events")
    public List<SeismicEventDto> getHistory(
            @RequestParam(required = false) Classification type,
            @RequestParam(value = "sensor_id", required = false) String sensorId,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return eventService.findByFilters(type, sensorId, region, from, to);
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

