package org.example.service;

import org.example.dto.SeismicEventDto;
import org.example.model.Classification;
import org.example.model.Event;
import org.example.repository.EventRepository;
import org.example.websocket.SeismicWebSocketHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Transactional
public class EventService {

    private final EventRepository eventRepository;
    private final SeismicWebSocketHandler webSocketHandler;

    public EventService(EventRepository eventRepository, SeismicWebSocketHandler webSocketHandler) {
        this.eventRepository = eventRepository;
        this.webSocketHandler = webSocketHandler;
    }

    @Transactional(readOnly = true)
    public List<SeismicEventDto> findByFilters(Classification type, String sensorId, String region, Instant from, Instant to) {
        String classification = type != null ? type.name() : null;
        return eventRepository.findByFilters(classification, sensorId, region, from, to)
                .stream()
                .map(SeismicEventDto::forHistory)
                .toList();
    }

    public Event save(Event event) {
        if (eventRepository.existsBySensorIdAndTimestampAndFrequency(
                event.getSensorId(), event.getTimestamp(), event.getFrequency())) {
            return event;
        }
        Event saved = eventRepository.save(event);
        webSocketHandler.broadcast(SeismicEventDto.forRealtime(saved));
        return saved;
    }
}
