package org.example.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

@Node("Sensor")
public class Sensor {

    @Id
    private String sensorId;

    protected Sensor() {}

    public Sensor(String sensorId) {
        this.sensorId = sensorId;
    }

    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }
}
