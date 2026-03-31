package org.example.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

import java.time.ZonedDateTime;

/**
 * Individual seismic detection by a single replica.
 * Multiple Events link to one Reporting via [:PART_OF].
 */
@Node("SeismicEvent")
public class Event {

    @Id
    private String eventId;

    private ZonedDateTime timestamp;
    private double frequency;
    private Classification classification;
    private String sensorId;
    private String replicaId;

    protected Event() {}

    public Event(String eventId, ZonedDateTime timestamp, double frequency,
                 Classification classification, String sensorId, String replicaId) {
        this.eventId = eventId;
        this.timestamp = timestamp;
        this.frequency = frequency;
        this.classification = classification;
        this.sensorId = sensorId;
        this.replicaId = replicaId;
    }

    public String getEventId() { return eventId; }

    public ZonedDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(ZonedDateTime timestamp) { this.timestamp = timestamp; }

    public double getFrequency() { return frequency; }
    public void setFrequency(double frequency) { this.frequency = frequency; }

    public Classification getClassification() { return classification; }
    public void setClassification(Classification classification) { this.classification = classification; }

    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public String getReplicaId() { return replicaId; }
    public void setReplicaId(String replicaId) { this.replicaId = replicaId; }
}

