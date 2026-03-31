package org.example.config;

import org.example.websocket.ReplicaStatusWebSocketHandler;
import org.example.websocket.SeismicWebSocketHandler;
import org.example.websocket.InfrastructureWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SeismicWebSocketHandler seismicHandler;
    private final ReplicaStatusWebSocketHandler replicaStatusHandler;
    private final InfrastructureWebSocketHandler infrastructureHandler;

    public WebSocketConfig(SeismicWebSocketHandler seismicHandler, ReplicaStatusWebSocketHandler replicaStatusHandler, InfrastructureWebSocketHandler infrastructureHandler) {
        this.seismicHandler = seismicHandler;
        this.replicaStatusHandler = replicaStatusHandler;
        this.infrastructureHandler = infrastructureHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(seismicHandler, "/api/events/ws")
                .setAllowedOriginPatterns("*");
        registry.addHandler(replicaStatusHandler, "/backend/ws")
                .setAllowedOriginPatterns("*");

        registry.addHandler(infrastructureHandler, "/api/infrastructure/ws")
            .setAllowedOriginPatterns("*");
    }
}
