package main

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/gorilla/websocket"
)

// struttura del messaggio che arriva dal sensore
type Measurement struct {
	Timestamp string  `json:"timestamp"`
	Value     float64 `json:"value"`
}

// struttura del messaggio che mandiamo alle repliche
// aggiungiamo il sensor_id per sapere da quale sensore viene
type Message struct {
	SensorID  string  `json:"sensor_id"`
	Timestamp string  `json:"timestamp"`
	Value     float64 `json:"value"`
}

func leggiSensore(sensor Sensor, hub *Hub, wg *sync.WaitGroup) {
	defer wg.Done()

	url := "ws://localhost:8080" + sensor.WebSocketURL
	fmt.Printf("Connessione a %s...\n", sensor.Name)

	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		fmt.Printf("Errore connessione %s: %v\n", sensor.Name, err)
		return
	}
	defer conn.Close()

	fmt.Printf("Connesso a %s!\n", sensor.Name)

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			fmt.Printf("Connessione persa con %s: %v\n", sensor.Name, err)
			return
		}

		// parsa il messaggio del sensore
		var measurement Measurement
		err = json.Unmarshal(raw, &measurement)
		if err != nil {
			fmt.Printf("Errore parsing %s: %v\n", sensor.ID, err)
			continue // skippa questo messaggio e vai al prossimo
		}

		// costruisci il messaggio da mandare alle repliche
		msg := Message{
			SensorID:  sensor.ID,
			Timestamp: measurement.Timestamp,
			Value:     measurement.Value,
		}

		// converti in JSON e manda a tutte le repliche
		data, err := json.Marshal(msg)
		if err != nil {
			fmt.Printf("Errore encoding %s: %v\n", sensor.ID, err)
			continue
		}

		hub.broadcast(data)
	}
}