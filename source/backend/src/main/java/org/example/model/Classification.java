package org.example.model;

public enum Classification {
    EARTHQUAKE, CONVENTIONAL_EXPLOSION, NUCLEAR_EVENT;

    public static Classification fromFrequency(double frequency) {
        if (frequency >= 8.0) return NUCLEAR_EVENT;
        if (frequency >= 3.0) return CONVENTIONAL_EXPLOSION;
        return EARTHQUAKE;
    }
}

