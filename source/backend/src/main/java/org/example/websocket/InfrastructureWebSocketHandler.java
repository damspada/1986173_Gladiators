package org.example.websocket;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InfrastructureWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(InfrastructureWebSocketHandler.class);

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final ObjectMapper objectMapper;

    public InfrastructureWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.debug("Infrastructure WS session opened: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.debug("Infrastructure WS session closed: {}", session.getId());
    }

    public void broadcastReplicaStatus(String replicaId, String status, String timestamp) {
        Map<String, String> payload = Map.of(
                "type", "replica_status",
                "replica_id", replicaId,
                "status", status,
                "timestamp", timestamp
        );

        try {
            TextMessage message = new TextMessage(objectMapper.writeValueAsString(payload));
            sessions.removeIf(session -> !session.isOpen());
            sessions.forEach(session -> {
                try {
                    synchronized (session) {
                        session.sendMessage(message);
                    }
                } catch (IOException e) {
                    log.warn("Failed to send infrastructure update to session {}: {}", session.getId(), e.getMessage());
                }
            });
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize infrastructure update: {}", e.getMessage());
        }
    }
}