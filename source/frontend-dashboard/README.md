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
