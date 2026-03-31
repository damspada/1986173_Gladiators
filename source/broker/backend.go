package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// ReplicaStatusEvent è il messaggio mandato al backend quando una replica si connette/disconnette
type ReplicaStatusEvent struct {
	ReplicaID string `json:"replica_id"`
	Status    string `json:"status"` // "connected" o "disconnected"
	Timestamp string `json:"timestamp"`
}

// BackendHub gestisce le connessioni SSE del backend
type BackendHub struct {
	clients map[chan []byte]struct{}
	mu      sync.RWMutex
	hub     *Hub // riferimento all'hub replica per lo snapshot iniziale
}

func newBackendHub() *BackendHub {
	return &BackendHub{
		clients: make(map[chan []byte]struct{}),
	}
}

// handleBackendSSE gestisce la connessione SSE dal backend
func (b *BackendHub) handleBackendSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := make(chan []byte, 16)

	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()
	fmt.Println("Backend connesso via SSE")

	// invia snapshot delle repliche già connesse al momento della connessione
	if b.hub != nil {
		now := time.Now().UTC().Format(time.RFC3339)
		for _, id := range b.hub.getConnectedIDs() {
			event := ReplicaStatusEvent{
				ReplicaID: id,
				Status:    "connected",
				Timestamp: now,
			}
			data, err := json.Marshal(event)
			if err == nil {
				select {
				case ch <- data:
				default:
				}
			}
		}
	}

	defer func() {
		b.mu.Lock()
		delete(b.clients, ch)
		b.mu.Unlock()
		fmt.Println("Backend disconnesso")
	}()

	for {
		select {
		case data := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

// notifica tutte le sessioni backend di un cambio di stato replica
func (b *BackendHub) notifyReplicaStatus(replicaID, status string) {
	event := ReplicaStatusEvent{
		ReplicaID: replicaID,
		Status:    status,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	data, err := json.Marshal(event)
	if err != nil {
		fmt.Printf("Errore encoding status event: %v\n", err)
		return
	}

	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.clients {
		select {
		case ch <- data:
		default:
			// client troppo lento, salto
		}
	}
}
