package org.example.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.model.Replica;
import org.example.repository.ReplicaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.ZonedDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

@Component
public class ReplicaStatusWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ReplicaStatusWebSocketHandler.class);

    private final ObjectMapper objectMapper;
    private final ReplicaRepository replicaRepository;

    public ReplicaStatusWebSocketHandler(ObjectMapper objectMapper, ReplicaRepository replicaRepository) {
        this.objectMapper = objectMapper;
        this.replicaRepository = replicaRepository;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.info("Broker connected for replica status updates: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        log.info("Broker disconnected: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            ReplicaStatusEvent event = objectMapper.readValue(message.getPayload(), ReplicaStatusEvent.class);
            log.debug("Received replica status: {} - {}", event.getReplicaId(), event.getStatus());

            Optional<Replica> optionalReplica = replicaRepository.findById(event.getReplicaId());
            if (optionalReplica.isPresent()) {
                Replica replica = optionalReplica.get();
                // Only update status if it's not already "shutting_down" (to preserve SHUTDOWN notification)
                if (!"shutting_down".equals(replica.getStatus())) {
                    replica.setStatus(event.getStatus());
                }
                replica.setLastSeen(ZonedDateTime.now(ZoneOffset.UTC));
                replicaRepository.save(replica);
                log.info("Updated replica {} status to {}", event.getReplicaId(), replica.getStatus());
            } else {
                // Create new replica if not exists
                Replica newReplica = new Replica(event.getReplicaId());
                newReplica.setStatus(event.getStatus());
                newReplica.setLastSeen(ZonedDateTime.now(ZoneOffset.UTC));
                replicaRepository.save(newReplica);
                log.info("Created new replica {} with status {}", event.getReplicaId(), event.getStatus());
            }
        } catch (Exception e) {
            log.error("Error processing replica status message: {}", e.getMessage());
        }
    }

    public static class ReplicaStatusEvent {
        private String replicaId;
        private String status;
        private String timestamp;

        public String getReplicaId() { return replicaId; }
        public void setReplicaId(String replicaId) { this.replicaId = replicaId; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    }
}