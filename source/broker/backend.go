package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ReplicaStatusEvent è il messaggio mandato al backend quando una replica si connette/disconnette
type ReplicaStatusEvent struct {
	ReplicaID string `json:"replica_id"`
	Status    string `json:"status"` // "connected" o "disconnected"
	Timestamp string `json:"timestamp"`
}

// BackendHub gestisce le connessioni WebSocket del backend
type BackendHub struct {
	sessions map[*websocket.Conn]struct{}
	mu       sync.RWMutex
}

func newBackendHub() *BackendHub {
	return &BackendHub{
		sessions: make(map[*websocket.Conn]struct{}),
	}
}

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// handleBackendWS gestisce la connessione WebSocket dal backend
func (b *BackendHub) handleBackendWS(w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("Errore upgrade WebSocket backend: %v\n", err)
		return
	}
	defer func() {
		b.mu.Lock()
		delete(b.sessions, conn)
		b.mu.Unlock()
		conn.Close()
		fmt.Println("Backend disconnesso")
	}()

	b.mu.Lock()
	b.sessions[conn] = struct{}{}
	b.mu.Unlock()
	fmt.Println("Backend connesso via WebSocket")

	// tieni la connessione aperta leggendo (e scartando) eventuali ping
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
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
	for conn := range b.sessions {
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			fmt.Printf("Errore invio status al backend: %v\n", err)
		}
	}
}
