package org.example.controller;

import org.example.dto.ReplicaEventDto;
import org.example.dto.SeismicEventDto;
import org.example.service.EventService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Receives aggregated reporting data from replicas and broadcasts it to
 * WebSocket clients for real-time updates. The actual Neo4j write is performed
 * by the replica directly — this endpoint only triggers the WebSocket fan-out.
 */
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
            eventService.broadcast(SeismicEventDto.forBroadcast(dto));
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.warn("Failed to broadcast event from replica: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
}
