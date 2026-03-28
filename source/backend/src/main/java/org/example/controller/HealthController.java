package org.example.controller;

import org.example.dto.HealthDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @Value("${server.port}")
    private int port;

    @GetMapping("/health")
    public HealthDto health() {
        return new HealthDto("ok", "seismic-backend", port);
    }
}

