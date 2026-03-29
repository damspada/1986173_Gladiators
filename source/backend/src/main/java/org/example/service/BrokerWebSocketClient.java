package org.example.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.example.model.DisconnectionEvent;
import org.example.model.Replica;
import org.example.repository.ReplicaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.client.ReactorNettyWebSocketClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.net.URI;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;

/**
 * Connects to the Go broker's WebSocket endpoint (/backend/ws) and listens for
 * ReplicaStatusEvent messages. Each message is persisted to Neo4j via MERGE so
 * every Replica node is kept up-to-date with its latest availability status.
 *
 * Message format from broker:
 *   { "replica_id": "...", "status": "connected"|"disconnected", "timestamp": "..." }
 */
@Service
public class BrokerWebSocketClient {

    private static final Logger log = LoggerFactory.getLogger(BrokerWebSocketClient.class);

    private final ReplicaRepository replicaRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${broker.ws-url:ws://broker:9090/backend/ws}")
    private String brokerWsUrl;

    public BrokerWebSocketClient(ReplicaRepository replicaRepository) {
        this.replicaRepository = replicaRepository;
    }

    @PostConstruct
    public void connect() {
        ReactorNettyWebSocketClient client = new ReactorNettyWebSocketClient();

        client.execute(URI.create(brokerWsUrl), session ->
                session.receive()
                        .map(WebSocketMessage::getPayloadAsText)
                        .doOnNext(this::handleMessage)
                        .doOnError(e -> log.warn("Broker WS error: {}", e.getMessage()))
                        .then()
        )
        .retryWhen(Retry.backoff(Long.MAX_VALUE, Duration.ofSeconds(5))
                .maxBackoff(Duration.ofSeconds(30))
                .doBeforeRetry(s -> log.warn("Reconnecting to broker WS (attempt {})...", s.totalRetries() + 1)))
        .subscribe(
                null,
                e -> log.error("Broker WS stream terminated permanently: {}", e.getMessage())
        );

        log.info("Broker WS client started → {}", brokerWsUrl);
    }

    private void handleMessage(String raw) {
        try {
            JsonNode node = objectMapper.readTree(raw);
            String replicaId = node.path("replica_id").asText(null);
            String status    = node.path("status").asText(null);
            String timestamp = node.path("timestamp").asText(null);

            if (replicaId == null || status == null) {
                log.warn("Ignoring malformed broker message: {}", raw);
                return;
            }

            ZonedDateTime eventTime = parseTimestamp(timestamp);

            // MERGE on replicaId so we update the existing node rather than create a new one
            Replica replica = replicaRepository.findById(replicaId)
                    .orElse(new Replica(replicaId));

            replica.setStatus(status);
            replica.setLastSeen(eventTime);
            if ("connected".equals(status)) {
                replica.setConnectedSince(eventTime);
            } else if ("disconnected".equals(status)) {
                DisconnectionEvent disconnection = new DisconnectionEvent(replicaId, eventTime, replica.getConnectedSince());
                replica.addDisconnection(disconnection);
            }

            replicaRepository.save(replica);
            log.info("Replica {} → {}", replicaId, status);

        } catch (Exception e) {
            log.warn("Failed to process broker message: {} — {}", raw, e.getMessage());
        }
    }

    private ZonedDateTime parseTimestamp(String raw) {
        if (raw == null || raw.isBlank()) return ZonedDateTime.now(ZoneOffset.UTC);
        try {
            return ZonedDateTime.parse(raw);
        } catch (DateTimeParseException e) {
            return ZonedDateTime.now(ZoneOffset.UTC);
        }
    }
}
