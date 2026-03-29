package main

import (
	"fmt"
	"net/http"
	"sync"
	"time"
)

func main() {
	// crea l'hub che notifica il backend dei cambi di stato replica
	backendHub := newBackendHub()

	// crea l'hub che gestisce le repliche
	hub := newHub(backendHub)

	// esponi l'endpoint SSE per le repliche
	http.HandleFunc("/stream", hub.handleSSE)

	// esponi il WebSocket per il backend (stato delle repliche)
	http.HandleFunc("/backend/ws", backendHub.handleBackendWS)

	// avvia il server HTTP in background così le repliche possono connettersi subito
	go func() {
		fmt.Println("Broker SSE avviato su :9090")
		if err := http.ListenAndServe(":9090", nil); err != nil {
			fmt.Printf("Errore server: %v\n", err)
		}
	}()

	// riprova a recuperare i sensori finché il simulatore non è pronto
	var sensors []Sensor
	for {
		var err error
		sensors, err = getSensors()
		if err == nil {
			break
		}
		fmt.Printf("In attesa del simulatore: %v. Riprovo tra 5s...\n", err)
		time.Sleep(5 * time.Second)
	}

	fmt.Printf("Trovati %d sensori\n", len(sensors))

	var wg sync.WaitGroup
	for _, sensor := range sensors {
		wg.Add(1)
		go leggiSensore(sensor, hub, &wg)
	}

	// blocca per sempre — il server SSE continua a girare
	select {}
}
