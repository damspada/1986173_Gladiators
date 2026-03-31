package org.example.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.example.model.DisconnectionEvent;
import org.example.model.Replica;
import org.example.repository.ReplicaRepository;
import org.example.websocket.InfrastructureWebSocketHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;

/**
 * Connects to the Go broker's SSE endpoint (/backend/sse) and listens for
 * ReplicaStatusEvent messages. Each message is persisted to Neo4j via MERGE so
 * every Replica node is kept up-to-date with its latest availability status.
 *
 * Message format from broker:
 *   { "replica_id": "...", "status": "connected"|"disconnected", "timestamp": "..." }
 */
@Service
public class BrokerSSEClient {

    private static final Logger log = LoggerFactory.getLogger(BrokerSSEClient.class);

    private final ReplicaRepository replicaRepository;
    private final InfrastructureWebSocketHandler infrastructureWebSocketHandler;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${broker.sse-url:http://broker:9090/backend/sse}")
    private String brokerSseUrl;

    public BrokerSSEClient(ReplicaRepository replicaRepository,
                                 InfrastructureWebSocketHandler infrastructureWebSocketHandler) {
        this.replicaRepository = replicaRepository;
        this.infrastructureWebSocketHandler = infrastructureWebSocketHandler;
    }

    /**
     * Opens the SSE connection to the broker and returns a stream of raw JSON strings.
     * Does not process messages — only handles transport and reconnection.
     */
    private Flux<String> streamFromBroker() {
        return WebClient.create(brokerSseUrl)
                .get()
                .retrieve()
                .bodyToFlux(new ParameterizedTypeReference<ServerSentEvent<String>>() {})
                .mapNotNull(ServerSentEvent::data)
                .filter(data -> !data.isBlank())
                .doOnError(e -> log.warn("Broker SSE error: {}", e.getMessage()))
                .retryWhen(Retry.backoff(Long.MAX_VALUE, Duration.ofSeconds(5))
                        .maxBackoff(Duration.ofSeconds(30))
                        .doBeforeRetry(s -> log.warn("Reconnecting to broker SSE (attempt {})...", s.totalRetries() + 1)));
    }

    @PostConstruct
    public void connect() {
        log.info("Clearing stale replicas from database before connecting to broker...");
        replicaRepository.deleteAllWithDisconnections();
        log.info("Stale replicas cleared.");

        streamFromBroker()
                .doOnNext(this::handleMessage)
                .subscribe(
                        null,
                        e -> log.error("Broker SSE stream terminated permanently: {}", e.getMessage())
                );

        log.info("Broker SSE client started → {}", brokerSseUrl);
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
            infrastructureWebSocketHandler.broadcastReplicaStatus(
                    replicaId,
                    status,
                    eventTime.toInstant().toString()
            );
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
