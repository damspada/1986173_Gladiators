package org.example.model;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

import java.time.Instant;

@Node("SeismicEvent")
public class Event {

    @Id
    @GeneratedValue(GeneratedValue.UUIDGenerator.class)
    private String id;

    private String eventId;
    private String sensorId;
    private Instant timestamp;
    private double frequency;
    private double amplitude;
    private Classification classification;
    private double lat;
    private double lon;
    private String region;

    protected Event() {}

    public Event(String eventId, String sensorId, Instant timestamp, double frequency,
                 double amplitude, Classification classification, double lat, double lon, String region) {
        this.eventId = eventId;
        this.sensorId = sensorId;
        this.timestamp = timestamp;
        this.frequency = frequency;
        this.amplitude = amplitude;
        this.classification = classification;
        this.lat = lat;
        this.lon = lon;
        this.region = region;
    }

    public String getId() { return id; }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    public double getFrequency() { return frequency; }
    public void setFrequency(double frequency) { this.frequency = frequency; }

    public double getAmplitude() { return amplitude; }
    public void setAmplitude(double amplitude) { this.amplitude = amplitude; }

    public Classification getClassification() { return classification; }
    public void setClassification(Classification classification) { this.classification = classification; }

    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }

    public double getLon() { return lon; }
    public void setLon(double lon) { this.lon = lon; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
}
