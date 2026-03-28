# Mock Backend Seismico (separato)

Backend fittizio per testare il frontend senza modificare il codice del frontend.

## Avvio

```bash
cd /home/spada/Documenti/magistrale/labAP/1986173_Gladiators/source/mock-backend
npm install
npm run dev
```

Porta di default: `8090`.

## Endpoint

- `GET /health`
- `GET /api/sensors`
- `GET /api/history/events?type=&sensor_id=&region=`
- `WS /api/events/ws`
- `GET /api/mock/stream` stato stream continuo
- `POST /api/mock/stream` start/stop stream e cambio intervallo
- `POST /api/mock/event` invio evento preciso manuale
- `GET /api/mock/presets` elenco preset demo
- `POST /api/mock/preset` avvio preset demo
- `POST /api/mock/preset/stop` stop eventi schedulati da preset

## Control UI backend

UI pronta per demo/testing backend:

- `http://localhost:8090/mock-ui/control.html`

Funzioni disponibili:

- start/stop invio continuo eventi
- modifica intervallo invio continuo (ms)
- invio evento manuale preciso (sensor/frequency/amplitude/timestamp)
- avvio preset demo preconfigurati
- stop immediato coda preset

## Esempi API controllo

Stop stream continuo:

```bash
curl -s -X POST http://localhost:8090/api/mock/stream \
	-H "Content-Type: application/json" \
	-d '{"enabled":false}'
```

Start stream a 2 secondi:

```bash
curl -s -X POST http://localhost:8090/api/mock/stream \
	-H "Content-Type: application/json" \
	-d '{"enabled":true,"intervalMs":2000}'
```

Avvio preset demo:

```bash
curl -s -X POST http://localhost:8090/api/mock/preset \
	-H "Content-Type: application/json" \
	-d '{"name":"demo_escalation"}'
```

## Collegare il frontend senza sporcarlo

Lancia il frontend passando le variabili solo a runtime:

```bash
cd /home/spada/Documenti/magistrale/labAP/1986173_Gladiators/source/frontend-dashboard
VITE_LIVE_WS_URL=ws://localhost:8090/api/events/ws \
VITE_HISTORY_API_URL=http://localhost:8090/api/history/events \
npm run dev
```

In questo modo non viene modificato nessun file del frontend.
