# Guida rapida: avvio Frontend + Backend mock e invio eventi

Questa guida serve per:
- avviare il frontend
- avviare un backend fittizio separato
- creare eventi manuali che vengono inviati al frontend

## 1) Avvio backend mock (separato)

Apri un terminale:

    cd /home/spada/Documenti/magistrale/labAP/1986173_Gladiators/source/mock-backend
    npm install
    npm run dev

Backend disponibile su:
- http://localhost:8090

Check rapido salute backend:

    curl -s http://localhost:8090/health

## 2) Avvio frontend collegato al backend mock

Apri un secondo terminale:

    cd /home/spada/Documenti/magistrale/labAP/1986173_Gladiators/source/frontend-dashboard
    VITE_LIVE_WS_URL=ws://localhost:8090/api/events/ws \
    VITE_HISTORY_API_URL=http://localhost:8090/api/history/events \
    npm run dev -- --host 0.0.0.0 --port 5174

Apri poi il browser su:
- http://localhost:5174

Nota:
- In questo modo il frontend NON viene modificato.
- Le variabili ambiente valgono solo per quella esecuzione.

## 3) Eventi automatici

Il backend mock invia automaticamente 1 evento al secondo via WebSocket.
Quindi appena apri la pagina Live Dashboard vedrai il feed aggiornarsi da solo.

## 4) Creazione evento manuale (test mirato)

Endpoint manuale:
- POST http://localhost:8090/api/mock/event

### Esempio 1: evento terremoto

    curl -s -X POST http://localhost:8090/api/mock/event \
      -H "Content-Type: application/json" \
      -d '{"sensor_id":"S-01","frequency":1.7,"amplitude":4.5}'

### Esempio 2: esplosione convenzionale

    curl -s -X POST http://localhost:8090/api/mock/event \
      -H "Content-Type: application/json" \
      -d '{"sensor_id":"S-03","frequency":5.2,"amplitude":7.0}'

### Esempio 3: evento nuclear-like

    curl -s -X POST http://localhost:8090/api/mock/event \
      -H "Content-Type: application/json" \
      -d '{"sensor_id":"S-06","frequency":9.6,"amplitude":10.1}'

Ogni POST:
- salva l evento nello storico
- lo invia subito ai client frontend connessi

## 5) Storico eventi (History)

Recupero storico completo:

    curl -s http://localhost:8090/api/history/events

Filtri esempio:

    curl -s "http://localhost:8090/api/history/events?type=EARTHQUAKE"
    curl -s "http://localhost:8090/api/history/events?sensor_id=S-03"
    curl -s "http://localhost:8090/api/history/events?region=EAST"

## 6) Stop servizi

Nel terminale del backend: Ctrl + C
Nel terminale del frontend: Ctrl + C
