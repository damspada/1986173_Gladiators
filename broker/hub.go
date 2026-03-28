package main

import (
	"fmt"
	"net/http"
	"sync"
)

// Client rappresenta una replica connessa via SSE
type Client struct {
	id      string
	channel chan []byte // canale su cui mandiamo i messaggi
}

// Hub gestisce tutte le repliche connesse
type Hub struct {
	clients map[string]*Client // mappa id -> client
	mu      sync.RWMutex       // protegge la mappa
}

func newHub() *Hub {
	return &Hub{
		clients: make(map[string]*Client),
	}
}

// aggiunge una replica
func (h *Hub) aggiungi(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client.id] = client
	fmt.Printf("Replica connessa: %s\n", client.id)
}

// rimuove una replica
func (h *Hub) rimuovi(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, client.id)
	close(client.channel) // chiudi il canale
	fmt.Printf("Replica disconnessa: %s\n", client.id)
}

// manda un messaggio a tutte le repliche
func (h *Hub) broadcast(messaggio []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		select {
		case client.channel <- messaggio: // manda il messaggio
		default:
			// il canale è pieno, la replica è troppo lenta — skippa
		}
	}
}

// handler SSE — chiamato quando una replica si connette
func (h *Hub) handleSSE(w http.ResponseWriter, r *http.Request) {
	// imposta gli header SSE obbligatori
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// crea il client per questa replica
	client := &Client{
		id:      r.RemoteAddr, // usiamo l'indirizzo IP come ID
		channel: make(chan []byte, 100),
	}

	h.aggiungi(client)
	defer h.rimuovi(client)

	// aspetta messaggi e li manda alla replica
	for {
		select {
		case messaggio := <-client.channel:
			// formato SSE: "data: <messaggio>\n\n"
			fmt.Fprintf(w, "data: %s\n\n", messaggio)
			w.(http.Flusher).Flush() // manda subito senza aspettare il buffer
		case <-r.Context().Done():
			// la replica si è disconnessa
			return
		}
	}
}