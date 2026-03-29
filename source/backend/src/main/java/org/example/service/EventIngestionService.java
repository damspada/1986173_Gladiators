package org.example.service;

import org.example.dto.SimulatorEventDto;
import org.example.model.Classification;
import org.example.model.Event;
import org.example.model.Region;
import org.example.model.Sensor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.scheduler.Schedulers;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.time.ZoneOffset;
import java.time.Instant;
import java.util.Objects;

/**
 * Disabled: event ingestion is now handled by replicas POSTing to /api/events.
 * Kept for reference. Remove @Service annotation was removed to prevent auto-wiring.
 */
public class EventIngestionService {

    private static final Logger log = LoggerFactory.getLogger(EventIngestionService.class);

    private final EventService eventService;
    private final WebClient webClient;

    @Value("${simulator.base-url}")
    private String simulatorBaseUrl;

    public EventIngestionService(EventService eventService, WebClient.Builder webClientBuilder) {
        this.eventService = eventService;
        this.webClient = webClientBuilder.build();
    }

    public void startIngestion() {
        webClient.get()
                .uri(simulatorBaseUrl + "/events/stream")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .retrieve()
                .bodyToFlux(SimulatorEventDto.class)
                .publishOn(Schedulers.boundedElastic())
                .map(this::toEntity)
                .filter(Objects::nonNull)
                .retryWhen(Retry.backoff(Long.MAX_VALUE, Duration.ofSeconds(5))
                        .doBeforeRetry(s -> log.warn("Retrying simulator connection (attempt {})", s.totalRetries() + 1)))
                .subscribe(
                        eventService::save,
                        error -> log.error("Ingestion stream terminated: {}", error.getMessage())
                );
    }

    private Event toEntity(SimulatorEventDto dto) {
        try {
            return new Event(
                    dto.eventId(),
                    Instant.parse(dto.timestamp()).atOffset(ZoneOffset.UTC).toZonedDateTime(),
                    dto.frequency(),
                    Classification.fromFrequency(dto.frequency()),
                    dto.lat(),
                    dto.lon(),
                    dto.sensorId(),
                    dto.region(),
                    new Sensor(dto.sensorId()),
                    new Region(dto.region())
            );
        } catch (Exception e) {
            log.warn("Skipping malformed simulator event {}: {}", dto.eventId(), e.getMessage());
            return null;
        }
    }
}
