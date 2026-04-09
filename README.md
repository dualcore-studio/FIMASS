# Fimass Sportello Amico

Portale interno per la gestione di richieste di preventivo assicurativo e richieste di emissione polizza.

## Stack Tecnologico

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Node.js + Express + InstantDB Admin SDK
- **Autenticazione**: JWT
- **Database**: InstantDB (persistente in cloud)

## Avvio Rapido

### 1. Installare le dipendenze

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configurare variabili ambiente backend

Nel progetto Vercel (o in `.env` locale):

```bash
INSTANT_APP_ID=...
INSTANT_ADMIN_TOKEN=...
JWT_SECRET=...
```

### 3. Inizializzare i dati base (bootstrap automatico)

Il backend crea automaticamente utenti e impostazioni minime al primo avvio se il database InstantDB è vuoto.

### 4. Avviare i server

In due terminali separati:

```bash
# Backend (porta 3001)
cd backend && npm run dev

# Frontend (porta 5173)
cd frontend && npm run dev
```

### 5. Accedere al portale

Aprire http://localhost:5173

## Credenziali di Test

| Ruolo | Username | Password |
|-------|----------|----------|
| Admin | admin | admin123 |
| Supervisore | supervisore1 | super123 |
| Operatore | operatore1 | oper123 |
| Struttura | struttura1 | strut123 |

## Ruoli

- **Admin**: Visione globale, gestione utenti e impostazioni
- **Supervisore**: Assegnazione pratiche, monitoraggio operativo
- **Operatore**: Lavorazione pratiche assegnate
- **Struttura**: Invio richieste preventivo, richiesta emissione polizza

## Flusso Principale

1. La **struttura** crea una richiesta di preventivo
2. Il **supervisore** assegna la pratica a un operatore
3. L'**operatore** la lavora e la segna come elaborata
4. La **struttura** richiede l'emissione della polizza dal preventivo elaborato
5. La polizza viene gestita internamente (verifica, emissione)

## Migrazione dati storici da SQLite

1. Esporta dal vecchio DB SQLite:

```bash
cd backend
npm run export:sqlite -- ../sqlite-export.json
```

2. Importa in InstantDB:

```bash
cd backend
npm run import:instantdb -- ../sqlite-export.json
```

Viene generato anche un report `instantdb-import-report.json`.

## Struttura Progetto

```
├── backend/
│   ├── src/
│   │   ├── config/       # Database setup
│   │   ├── middleware/    # Auth JWT
│   │   ├── routes/        # API routes
│   │   └── seed/          # Dati di test
│   └── data/              # SQLite database
│
├── frontend/
│   └── src/
│       ├── components/    # UI components
│       ├── context/       # Auth context
│       ├── pages/         # Pagine applicazione
│       ├── types/         # TypeScript types
│       └── utils/         # Utility functions
```
