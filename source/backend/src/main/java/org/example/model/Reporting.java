package org.example.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import java.time.ZonedDateTime;

@Node("Reporting")
public class Reporting {

    @Id
    private String reportingId;

    private ZonedDateTime timestamp;
    private double avgFrequency;
    private String classification;
    private boolean confirmed;

    private String sensorId;
    private String region;
    private double lat;
    private double lon;

    @Relationship(type = "OBSERVED", direction = Relationship.Direction.INCOMING)
    private Sensor sensor;

    @Relationship(type = "OCCURRED_IN", direction = Relationship.Direction.OUTGOING)
    private Region occurredIn;

    protected Reporting() {}

    public Reporting(String reportingId, ZonedDateTime timestamp, double avgFrequency,
                     String classification, double lat, double lon,
                     String sensorId, String region, Sensor sensor, Region occurredIn) {
        this.reportingId = reportingId;
        this.timestamp = timestamp;
        this.avgFrequency = avgFrequency;
        this.classification = classification;
        this.lat = lat;
        this.lon = lon;
        this.sensorId = sensorId;
        this.region = region;
        this.sensor = sensor;
        this.occurredIn = occurredIn;
        this.confirmed = false;
    }

    public String getReportingId() { return reportingId; }

    public ZonedDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(ZonedDateTime timestamp) { this.timestamp = timestamp; }

    public double getAvgFrequency() { return avgFrequency; }
    public void setAvgFrequency(double avgFrequency) { this.avgFrequency = avgFrequency; }

    public String getClassification() { return classification; }
    public void setClassification(String classification) { this.classification = classification; }

    public boolean isConfirmed() { return confirmed; }
    public void setConfirmed(boolean confirmed) { this.confirmed = confirmed; }

    public String getSensorId() { return sensorId; }
    public void setSensorId(String sensorId) { this.sensorId = sensorId; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }

    public double getLon() { return lon; }
    public void setLon(double lon) { this.lon = lon; }

    public Sensor getSensor() { return sensor; }
    public void setSensor(Sensor sensor) { this.sensor = sensor; }

    public Region getOccurredIn() { return occurredIn; }
    public void setOccurredIn(Region occurredIn) { this.occurredIn = occurredIn; }
}
