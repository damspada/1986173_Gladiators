package org.example.controller;

import org.example.dto.ReplicaEventDto;
import org.example.model.Classification;
import org.example.model.Event;
import org.example.service.EventService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

@RestController
@RequestMapping("/api/events")
public class IngestionController {

    private static final Logger log = LoggerFactory.getLogger(IngestionController.class);

    private final EventService eventService;

    public IngestionController(EventService eventService) {
        this.eventService = eventService;
    }

    @PostMapping
    public ResponseEntity<Void> ingest(@RequestBody ReplicaEventDto dto) {
        try {
            Instant ts = parseTimestamp(dto.timestamp());
            Event event = new Event(
                    dto.eventId(),
                    dto.sensorId(),
                    ts,
                    dto.frequency(),
                    0.0,
                    Classification.valueOf(dto.type()),
                    dto.lat(),
                    dto.lon(),
                    dto.region()
            );
            eventService.save(event);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Failed to ingest event from replica: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    private static Instant parseTimestamp(String raw) {
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException e) {
            return OffsetDateTime.parse(raw).toInstant();
        }
    }
}
