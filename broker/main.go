package main

import (
	"fmt"
	"net/http"
	"sync"
)

func main() {
	// crea l'hub che gestisce le repliche
	hub := newHub()

	// esponi l'endpoint SSE per le repliche
	http.HandleFunc("/stream", hub.handleSSE)

	// lancia i sensori in background
	sensors, err := getSensors()
	if err != nil {
		fmt.Println("Errore nel recupero dei sensori:", err)
		return
	}

	var wg sync.WaitGroup
	for _, sensor := range sensors {
		wg.Add(1)
		go leggiSensore(sensor, hub, &wg)
	}

	// avvia il server HTTP sulla porta 9090
	fmt.Println("Broker avviato su http://localhost:9090")
	err = http.ListenAndServe(":9090", nil)
	if err != nil {
		fmt.Println("Errore server:", err)
	}
}
