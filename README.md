# Fimass Sportello Amico

Portale interno per la gestione di richieste di preventivo assicurativo e richieste di emissione polizza.

## Stack Tecnologico

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Node.js + Express + better-sqlite3
- **Autenticazione**: JWT
- **Database**: SQLite (facilmente migrabile a PostgreSQL)

## Avvio Rapido

### 1. Installare le dipendenze

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Inizializzare il database con dati seed

```bash
cd backend && npm run seed
```

### 3. Avviare i server

In due terminali separati:

```bash
# Backend (porta 3001)
cd backend && npm run dev

# Frontend (porta 5173)
cd frontend && npm run dev
```

### 4. Accedere al portale

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
