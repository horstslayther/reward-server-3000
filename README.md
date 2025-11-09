# Reward Server

Ein leichtgewichtiger Node/Express-Server mit SQLite-Storage und einer statischen, installierbaren Web-App für Haushaltsaufgaben, Credits und Rewards. Teens haken Aufgaben ab, Eltern genehmigen, das Guthaben wird im Ledger verbucht und Rewards lassen sich freischalten – inklusive Discord-Benachrichtigungen und Offline-PWA.

## Features

- **Tasks & Workflow** – Aufgaben mit Beschreibung, Credits und Status `open → pending_approval → approved/deleted`, inkl. Papierkorb & Restore (`src/routes/tasks.js`).
- **Ledger & Balance** – Jede Gutschrift/Buchung landet im Ledger, das aktuelle Saldo + reservierte Beträge wird zentral berechnet (`src/db.js`, `src/routes/balance.js`).
- **Rewards & Sparziele** – User können Credits für Rewards reservieren, Zielstände verfolgen und Rewards einlösen; Admins pflegen den Reward-Katalog (`src/routes/rewards.js`).
- **Recurring Tasks** – Daily/Weekly-Vorlagen erzeugen automatisch neue Aufgaben, solange keine offene Kopie existiert (`src/recurring.js`, `src/routes/recurring.js`).
- **Mehrere Rollen** – Admin/User mit Session-Cookies und optionalem „eingeloggt bleiben“ (`src/routes/auth.js`).
- **Discord Webhooks** – Optionale Pushes bei wichtigen Events + Admin-Endpunkte zum Testen des Webhooks (`src/notify.js`, `src/routes/notify.js`).
- **PWA Frontend** – `public/index.html` liefert eine moderne, responsive UI mit Service Worker (`public/sw.js`) und Manifest (`public/manifest.webmanifest`).

## Tech Stack

- Node.js 18+ (ESM, eingebautes `fetch`)
- Express 4, better-sqlite3, express-session + connect-sqlite3, bcryptjs, sharp
- Vanilla JS Single-Page UI mit Service Worker & Manifest
- Discord Webhook Integration (optional)

## Projektstruktur

.
├─ public/ # UI, Service Worker, Manifest, Icons
├─ src/
│ ├─ server.js # Express Entry Point, Routing
│ ├─ db.js # SQLite-Verbindung + Schema
│ ├─ session.js # Session-Store (SQLite)
│ ├─ auth.js # Role-/Auth-Middleware
│ ├─ recurring.js # Generator für wiederkehrende Aufgaben
│ ├─ generate-icons.js # PNGs aus SVG via sharp
│ ├─ notify.js # Discord-Webhooks
│ └─ routes/ # REST-Router für Tasks, Rewards, Balance, Users, Auth, Recurring, Notify
├─ data/ # Laufzeitdatenbanken (SQLite)
├─ .env(.example) # Konfiguration
├─ package.json # Scripts & Dependencies
└─ README.md # (diese Datei)


## Voraussetzungen

- Node.js **18+** (wegen ESM & globalem `fetch`)
- npm (oder pnpm/yarn)
- Für `sharp`: passende native Builds/Build-Tools (auf Windows ggf. `windows-build-tools`)

## Setup

1. `cp .env.example .env`
2. `.env` anpassen (siehe Tabelle unten).
3. Abhängigkeiten installieren:

   ```bash
   npm install
Development-Server mit automatischem Neustart:

npm run dev
Produktion:

npm start
UI öffnen: http://localhost:3000

Beim ersten Start legt der Server automatisch einen Admin an (ADMIN_USERNAME/ADMIN_PASSWORD).

Environment-Variablen
Variable	Pflicht	Default	Beschreibung
PORT	nein	3000	HTTP-Port des Servers
SESSION_SECRET	ja	dev_secret...	Key für Session-Cookies
ADMIN_USERNAME	nein	admin	Wird beim Seeding verwendet
ADMIN_PASSWORD	nein	admin	Wird beim Seeding verwendet
SESSION_REMEMBER_DAYS	nein	30	Lebensdauer der „eingeloggt bleiben“-Cookies
DISCORD_WEBHOOK_URL	optional	–	Discord-Webhook für Benachrichtigungen
Alle Variablen werden früh via src/env.js geladen, bevor Sessions/Router initialisiert werden.

Daten & Persistenz
SQLite-Dateien liegen unter data/ (src/db.js (line 5)):
app.db – Tasks, Rewards, Ledger, Users, Recurring Templates, Savings
app.db-shm/wal – WAL-Dateien
sessions.db – Session-Store
Backups = einfach Ordner data/ sichern.
Der Server erstellt fehlende Tabellen/Spalten bei jedem Start.
Authentifizierung & Rollen
Login via /auth/login mit Benutzername/Passwort, Sessions liegen im SQLite-Store (src/session.js (line 14)).
Erste Admin-Credentials stammen aus .env; weitere Users/Teens legt der Admin via UI oder /auth/register an.
Rollen: admin (CRUD auf alles) & user (Tasks abschließen, Rewards sparen/einlösen).
requireAuth/requireRole schützen alle Mutationen (src/auth.js (line 1)).
API-Quick-Reference
Auth (/auth)
GET /auth/me – Session-Info
POST /auth/login { username, password, stayLoggedIn? }
POST /auth/logout
POST /auth/register (admin) – neue Benutzer
Tasks (/tasks)
GET /tasks[?status=open|pending_approval|approved|deleted] – erzeugt fällige Recurring-Tasks on-the-fly
POST /tasks (admin) – neue Aufgabe
PATCH /tasks/:id/complete (user)
PATCH /tasks/:id/approve | /reject | /restore (admin)
DELETE /tasks/:id (admin) – Soft-Delete
DELETE /tasks/:id/purge (admin) – Hard-Delete
Rewards (/rewards)
GET /rewards – Liefert „saved“-Feld für eingeloggte User
POST /rewards (admin)
PATCH /rewards/:id (admin)
DELETE /rewards/:id (admin)
POST /rewards/:id/allocate { amount } (user) – Credits reservieren/freigeben
POST /rewards/:id/redeem (user) – Reward einlösen (bucht Ledger)
Balance & Ledger
GET /balance – aktuelles Saldo + reserviert + verfügbar
GET /ledger
POST /ledger/adjust { amount, reason } (admin)
DELETE /ledger/:id (admin)
Recurring (/recurring)
GET /recurring (admin)
POST /recurring
PATCH /recurring/:id
DELETE /recurring/:id
POST /recurring/:id/run (admin) – sofortige Generierung
Users (/users)
GET /users (admin)
PATCH /users/:id (admin) – Rolle ändern
PATCH /users/:id/password (admin) – Passwort zurücksetzen
DELETE /users/:id (admin) – schützt vor „letzten Admin löschen“
Notify (/notify)
GET /notify/status (admin) – zeigt ob Webhook gültig ist
POST /notify/test (admin) – sendet Testmeldung
Frontend & PWA
UI in public/index.html mit reichlich Vanilla-JS-Logic (Tabs, Admin-Controls, Reservieren, Motivationsbanner).
Service Worker public/sw.js cached App-Shell + API-GETs (network-first für Navigations, cache-first für Assets).
Manifest public/manifest.webmanifest + Icons unter public/icons/.
Bei Serverstart generiert src/generate-icons.js PNG-Icons aus icons/icon.svg (wenn sharp verfügbar ist).
Service Worker wird nach dem Login-Flow registriert (public/index.html (line 639)).
Discord-Benachrichtigungen
.env → DISCORD_WEBHOOK_URL setzen.
Admin kann Status/Test im UI triggern (/notify/status, /notify/test).
Events: neue Tasks, abgeschlossene/abgelehnte Tasks, Genehmigungen, Rewards, Ledger-Anpassungen, Recurring-Generierungen.
Entwicklung & Betrieb
npm run dev nutzt nodemon für schnelles Iterieren.
Prod-Run via npm start (reiner Node-Prozess).
Für Deployments reicht ein Node-Prozess + beschreibbares data/-Verzeichnis. Keine externe DB nötig.
Backup/Restore = Ordner data/ kopieren/ersetzen.
Troubleshooting
sharp Build: Auf Windows ggf. npm install --global --production windows-build-tools ausführen oder vorcompilierte Binaries nutzen.
Rechte: Server benötigt Schreibrechte auf data/ (SQLite & Sessions) und public/icons/ (falls PNG-Generierung).
Node-Version: Bei <18 fehlt globales fetch; dann node --version prüfen und updaten.