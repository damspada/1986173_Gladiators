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
	clients    map[string]*Client // mappa id -> client
	mu         sync.RWMutex       // protegge la mappa
	backendHub *BackendHub        // notifica il backend dei cambi di stato
	bufferSize int                // dimensione canale per ogni replica
}

func newHub(backendHub *BackendHub, bufferSize int) *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		backendHub: backendHub,
		bufferSize: bufferSize,
	}
}

// aggiunge una replica
func (h *Hub) aggiungi(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client.id] = client
	fmt.Printf("Replica connessa: %s\n", client.id)
	go h.backendHub.notifyReplicaStatus(client.id, "connected")
}

// rimuove una replica
func (h *Hub) rimuovi(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, client.id)
	close(client.channel) // chiudi il canale
	fmt.Printf("Replica disconnessa: %s\n", client.id)
	go h.backendHub.notifyReplicaStatus(client.id, "disconnected")
}

// manda un messaggio a tutte le repliche.
// Se il canale è pieno, scarta il messaggio più vecchio e inserisce quello nuovo
// (drop-oldest): la replica riceve sempre i dati più recenti quando si riallinea.
func (h *Hub) broadcast(messaggio []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		select {
		case client.channel <- messaggio:
		default:
			// canale pieno: rimuovi il messaggio più vecchio, poi inserisci il nuovo
			select {
			case <-client.channel:
			default:
			}
			select {
			case client.channel <- messaggio:
			default:
			}
		}
	}
}

// handler SSE — chiamato quando una replica si connette
func (h *Hub) handleSSE(w http.ResponseWriter, r *http.Request) {
	// imposta gli header SSE obbligatori
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	// usa l'ID fornito dalla replica; fallback all'indirizzo IP se assente
	replicaID := r.Header.Get("X-Replica-ID")
	if replicaID == "" {
		replicaID = r.RemoteAddr
	}

	// crea il client per questa replica
	client := &Client{
		id:      replicaID,
		channel: make(chan []byte, h.bufferSize),
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