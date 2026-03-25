# Deployment su Railway

Guida completa per pubblicare Fimass Sportello Amico su Railway.

## Prerequisiti

- Account GitHub (gratuito)
- Account Railway (https://railway.com) — piano Trial gratuito o Hobby a $5/mese
- Git installato localmente

---

## Step 1 — Creare il repository GitHub

```bash
cd "/Users/pasqualedeluca/Documents/PROGETTI WEBAPP/FIMASS"

git init
git add .
git commit -m "Initial commit — Fimass Sportello Amico"

# Creare un repo su GitHub (pubblico o privato), poi:
git remote add origin https://github.com/TUO-USERNAME/fimass-sportello-amico.git
git branch -M main
git push -u origin main
```

## Step 2 — Creare il progetto su Railway

1. Vai su https://railway.com e accedi
2. Clicca **"New Project"**
3. Seleziona **"Deploy from GitHub Repo"**
4. Autorizza Railway ad accedere al repository
5. Seleziona il repo `fimass-sportello-amico`

Railway rileva automaticamente `railway.json` e configura build + start.

## Step 3 — Creare un Volume persistente

Il database SQLite e gli upload vivono sul filesystem.
Senza un volume, ogni re-deploy li cancellerebbe.

1. Nel progetto Railway, clicca sul tuo servizio
2. Vai alla tab **"Volumes"**
3. Clicca **"+ New Volume"**
4. Mount path: `/data`
5. Conferma

## Step 4 — Configurare le variabili d'ambiente

Nella tab **"Variables"** del servizio, aggiungi:

| Variabile | Valore | Note |
|-----------|--------|------|
| `NODE_ENV` | `production` | Obbligatorio |
| `JWT_SECRET` | *(stringa casuale di 64+ caratteri)* | Obbligatorio — genera con `openssl rand -hex 32` |
| `DB_PATH` | `/data/fimass.db` | Punta al volume montato |
| `UPLOADS_DIR` | `/data/uploads` | Punta al volume montato |

**Per generare il JWT_SECRET:**

```bash
openssl rand -hex 32
```

Copia il risultato e incollalo come valore di `JWT_SECRET`.

**Non servono** `PORT` (Railway lo imposta automaticamente) né `CORS_ORIGIN`.

## Step 5 — Deploy

Railway fa il deploy automaticamente al push.
Se non parte da solo:

1. Vai alla tab **"Deployments"**
2. Clicca **"Deploy"** o **"Redeploy"**

### Cosa succede durante il deploy

1. **Build**: installa le dipendenze frontend, compila React in `frontend/dist/`, installa le dipendenze backend
2. **Start**: esegue il seed (idempotente — non duplica dati), poi avvia Express
3. Express serve sia l'API (`/api/*`) che il frontend compilato (tutto il resto)

## Step 6 — Ottenere l'URL pubblico

1. Nella tab **"Settings"** del servizio
2. Sezione **"Networking"** → **"Public Networking"**
3. Clicca **"Generate Domain"**
4. Railway assegna un URL tipo `fimass-sportello-amico-production.up.railway.app`

Apri quell'URL nel browser → vedrai la pagina di login.

---

## Credenziali di test

| Ruolo | Username | Password |
|-------|----------|----------|
| Admin | `admin` | `admin123` |
| Supervisore | `supervisore1` | `super123` |
| Operatore | `operatore1` | `oper123` |
| Struttura | `struttura1` | `strut123` |

---

## Risoluzione problemi

### Il seed si ripete ad ogni deploy?
No. Lo script `seed.js` è idempotente: controlla se l'utente `admin` esiste già. Se esiste, esce senza fare nulla.

### Come faccio il re-seed completo?
Devi eliminare il file database dal volume. Nella Railway CLI:

```bash
railway shell
rm /data/fimass.db
```

Al prossimo restart, il seed ricrea tutto.

### Il deploy fallisce sul build frontend?
Controlla nei log che Node.js sia >= 18. Railway usa di default una versione recente, quindi non dovrebbe essere un problema.

### Gli upload scompaiono dopo un re-deploy?
Verifica che il volume sia montato su `/data` e che `UPLOADS_DIR` punti a `/data/uploads`.

### SPA routing non funziona (404 su refresh)?
Il server Express ha un fallback `*` che serve `index.html` per qualsiasi route non-API. Se vedi 404, controlla che `frontend/dist/index.html` esista dopo il build.

---

## Architettura in produzione

```
Browser → Railway (HTTPS)
              │
              ├─ GET /api/*          → Express API routes
              ├─ GET /uploads/*      → File statici dal volume
              ├─ GET /assets/*       → Frontend build (JS/CSS)
              └─ GET /*              → index.html (SPA fallback)
              │
              └─ Volume /data/
                   ├─ fimass.db      (SQLite)
                   └─ uploads/       (file allegati)
```

## Sviluppo locale (invariato)

```bash
# Terminale 1
cd backend && npm run dev

# Terminale 2
cd frontend && npm run dev
```

Il proxy Vite in `vite.config.ts` continua a funzionare come prima in development.
