# Source Orchestration

Questo compose permette di orchestrare:

- frontend dashboard (React + Nginx)
- backend del teammate (immagine esterna)
- simulator ufficiale dell'assignment

## Prerequisiti

1. Docker e Docker Compose installati
2. Immagine del backend disponibile localmente oppure su registry accessibile
3. Immagine simulator caricata localmente:

```bash
docker load -i seismic-signal-simulator-oci.tar
```

## Avvio rapido

```bash
cd /home/spada/Documenti/magistrale/labAP/1986173_Gladiators/source
cp .env.compose.example .env
# modifica BACKEND_IMAGE e, se necessario, i path API

docker compose up --build
```

## Variabili chiave

- `BACKEND_IMAGE`: immagine backend del teammate
- `BACKEND_UPSTREAM`: host:porta usato dal reverse proxy del frontend (default `backend:8080`)
- `VITE_LIVE_WS_URL`: endpoint websocket usato dal frontend (default `/api/events/ws`)
- `VITE_HISTORY_API_URL`: endpoint storico usato dal frontend (default `/api/history/events`)
- `SIMULATOR_BASE_URL`: base URL del simulatore vista dal backend (default `http://simulator:8080`)

## Porte host default

- frontend: `5173`
- backend: `8090`
- simulator: `8080`
