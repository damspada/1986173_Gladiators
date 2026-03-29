# Frontend Dashboard

Frontend React + Vite per monitoraggio sismico realtime e vista storico.

## Configurazione ambiente (obbligatoria)

La URL realtime backend e la URL storico backend sono obbligatorie.
Se `VITE_LIVE_WS_URL` manca, il frontend non usa fallback hardcoded e segnala configurazione assente.

1. Copia il file di esempio:

```bash
cp .env.example .env
```

2. Imposta le variabili nel file `.env`:

```env
VITE_LIVE_WS_URL=ws://localhost:8090/api/events/ws
VITE_HISTORY_API_URL=http://localhost:8090/api/history/events
```

Nota: per backend reale con stream per singolo sensore usare il path fornito dal contratto, ad esempio:

```env
VITE_LIVE_WS_URL=ws://backend-host:port/api/device/S-01/ws
```

## Avvio sviluppo

```bash
npm install
npm run dev
```

## Qualita codice

```bash
npm run lint
npm run build
```

## Esecuzione con Docker Compose (frontend + backend + simulator)

Nel repository e presente un orchestratore in `source/docker-compose.yml` pensato per
integrare questo frontend con il backend sviluppato da un altro membro del team.

1. Copia il file ambiente compose:

```bash
cd /home/spada/Documenti/magistrale/labAP/1986173_Gladiators/source
cp .env.compose.example .env
```

2. Imposta almeno l'immagine backend del teammate:

```env
BACKEND_IMAGE=ghcr.io/<org>/<backend-image>:<tag>
```

3. Avvia i servizi:

```bash
docker compose up --build
```

Endpoint default:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8090`
- simulator: `http://localhost:8080`

Note operative:

- `VITE_LIVE_WS_URL` e `VITE_HISTORY_API_URL` sono variabili di build del frontend.
- Se usi path relativi (default), Nginx nel container frontend inoltra `/api/*` verso `BACKEND_UPSTREAM`.
- Se il backend del teammate espone path diversi, aggiorna le due variabili in `.env`.
