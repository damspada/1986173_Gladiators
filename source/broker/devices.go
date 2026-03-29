package main

import (
	"encoding/json"
	"io"
	"net/http"
)

type Coordinates struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type Sensor struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Category     string      `json:"category"`
	Region       string      `json:"region"`
	Coordinates  Coordinates `json:"coordinates"`
	WebSocketURL string      `json:"websocket_url"`
}

func getSimulatorURL() string {
	return "http://simulator:8080"
}

func getSensors() ([]Sensor, error) {
	risposta, err := http.Get(getSimulatorURL() + "/api/devices/")
	if err != nil {
		return nil, err
	}
	defer risposta.Body.Close()

	body, err := io.ReadAll(risposta.Body)
	if err != nil {
		return nil, err
	}

	var sensors []Sensor
	err = json.Unmarshal(body, &sensors)
	if err != nil {
		return nil, err
	}

	return sensors, nil
}
