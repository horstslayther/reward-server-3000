# Reward 3000 – Aufgaben & Rewards mit Credits

Reward 3000 ist ein leichtgewichtiger Haushalts-Gamification-Server: Kids erledigen Aufgaben, sammeln Credits und lösen Rewards ein – Eltern behalten dabei über ein Ledger den Überblick. Das Projekt besteht aus einem Node/Express-Backend mit SQLite-Persistenz und einer modernen, offlinefähigen Web-App (PWA) auf Vanilla-JavaScript-Basis.

## Highlights

- **Task-Workflow** – Aufgaben durchlaufen `open → pending_approval → approved` inklusive Papierkorb/Restore und Admin-Review.
- **Benutzergebundene Konten** – Jede Buchung wird einem User-Konto zugeordnet, inklusive reservierter Beträge für Sparziele.
- **Rewards & Sparziele** – User reservieren Credits für Rewards, Admins pflegen den Katalog; Einlösen bucht automatisch im Ledger.
- **Ledger & Korrekturen** – Jede Transaktion landet im Ledger, Admins können Einträge filtern und Korrekturen je Benutzer buchen.
- **Recurring Tasks** – Daily/Weekly-Vorlagen erzeugen automatisch neue Tasks, solange keine offene Kopie existiert.
- **Discord-Webhooks** – (Optional) Benachrichtigungen für neue/abgeschlossene Aufgaben, Rewards oder Ledger-Events.
- **PWA-Frontend** – Offlinefähig, responsive und installierbar; läuft komplett mit nativen Browser-APIs.

## Systemvoraussetzungen

- Node.js **18+** (wegen ESM & globalem `fetch`)
- npm (oder pnpm/yarn)
- Schreibrechte auf `data/` und `public/icons/`
- Für optionales Icon-Rendering: funktionierende `sharp`-Installation (unter Windows ggf. zusätzliche Buildtools)

## Installation & Start

```bash
# Repository klonen
git clone <repo-url> reward-server
cd reward-server

# Dependencies installieren
npm install

# .env anlegen und anpassen
cp .env.example .env
# Datei editieren und z. B. SESSION_SECRET, ADMIN_* etc. setzen

# Entwicklung (mit Nodemon Reload)
npm run dev

# Produktion
npm start
```

Standardmäßig lauscht der Server auf `http://localhost:3000`. Beim ersten Start wird automatisch ein Admin (Username/Passwort aus `.env`) erstellt.

### Wichtige Umgebungsvariablen (`.env`)

| Variable               | Pflicht | Default | Beschreibung                                      |
| ---------------------- | ------- | ------- | ------------------------------------------------- |
| `PORT`                 | nein    | `3000`  | HTTP-Port                                         |
| `SESSION_SECRET`       | ja      | –       | Secret für Sitzungscookies                        |
| `SESSION_REMEMBER_DAYS`| nein    | `30`    | Laufzeit der „eingeloggt bleiben“-Cookies         |
| `ADMIN_USERNAME`       | nein    | `admin` | Initialer Admin-Benutzername                      |
| `ADMIN_PASSWORD`       | nein    | `admin` | Initiales Admin-Passwort                          |
| `DISCORD_WEBHOOK_URL`  | optional| –       | URL für Discord-Benachrichtigungen                |

Alle Variablen werden beim Start via `src/env.js` geladen.

## Projektstruktur (Auszug)

```
├─ public/                # Frontend (HTML, CSS, JS, Icons, Service Worker)
├─ src/
│  ├─ server.js           # Express-Entry, Routing
│  ├─ db.js               # SQLite-Setup + Helper
│  ├─ session.js          # express-session + SQLite-Store
│  ├─ auth.js             # requireAuth / requireRole
│  ├─ recurring.js        # Logik für wiederkehrende Aufgaben
│  ├─ notify.js           # Discord-Helfer
│  └─ routes/             # REST-Router (tasks, rewards, balance, users, auth, recurring, notify)
├─ data/                  # SQLite-Dateien (app.db, sessions.db, WALs …)
├─ .env(.example)         # Environment-Konfiguration
└─ package.json
```

## Wichtige Skripte

- `npm run dev` – startet den Server mit nodemon (auto-reload)
- `npm start` – Produktionsstart ohne Reload
- `node src/generate-icons.js` – optionales Regenerieren der PNG-Icons aus `public/icons/icon.svg`

## Backend-APIs (Kurzüberblick)

| Route        | Methoden / Endpunkte                                                                 | Beschreibung                                    |
| ------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `/auth`      | `GET /me`, `POST /login`, `POST /logout`, `POST /register` (Admin)                   | Sessions und Nutzerverwaltung                   |
| `/tasks`     | `GET`, `POST` (Admin), `PATCH` (complete/approve/reject/restore), `DELETE` (Soft/Purge) | Taskworkflow inkl. Recurring                     |
| `/rewards`   | `GET`, `POST/PATCH/DELETE` (Admin), `POST /:id/allocate`, `POST /:id/redeem`         | Rewards & Sparziele                             |
| `/balance`   | `GET /balance`, `GET /ledger`, `POST /ledger/adjust`, `DELETE /ledger/:id`           | Ledgerfunktionen pro Benutzer                   |
| `/recurring` | CRUD + `POST /:id/run` (Admin)                                                       | Pflege der Vorlagen                             |
| `/users`     | `GET`, `PATCH role/password`, `DELETE` (Admin)                                       | Benutzerverwaltung                              |
| `/notify`    | `GET /status`, `POST /test` (Admin)                                                  | Discord-Webhook-Checks                          |

Alle mutierenden Routen sind durch `requireAuth`/`requireRole` geschützt.

## Frontend & PWA

- Single-Page-App unter `public/index.html` mit Tabs für Tasks, Rewards und Admin-Panel.
- Service Worker (`public/sw.js`) cached App-Shell und statische Assets (network-first für Navigations, cache-first für Assets).
- Manifest + Icons unter `public/manifest.webmanifest` und `public/icons/`.
- Admin-spezifische Bereiche (Benutzer- und Recurring-Verwaltung, Ledger-Korrekturen) sind direkt in der Web-App integriert.

## Daten & Backups

- `data/app.db` enthält Tasks, Rewards, Ledger, Users, Recurring-Templates und Sparstände.
- `data/sessions.db` speichert Sessiondaten.
- WAL-Dateien (`*.db-wal`, `*.db-shm`) gehören ebenfalls zum Backup.
- Für Backups genügt es, den gesamten `data/`-Ordner zu sichern (bei gestopptem Server).

## Discord-Webhooks

1. URL in `.env` unter `DISCORD_WEBHOOK_URL` eintragen.
2. Im Admin-Panel lässt sich der Status prüfen bzw. eine Testnachricht triggern.
3. Benachrichtigungen decken u. a. neue Aufgaben, Genehmigungen, Rewards und Ledger-Korrekturen ab.

## Troubleshooting

- **`sharp`-Buildfehler**: Unter Windows ggf. `npm install --global --production windows-build-tools` ausführen oder prebuilt-Binaries verwenden.
- **SQLite-Locks/Schreibprobleme**: sicherstellen, dass `data/` beschreibbar ist und kein anderer Prozess die DBs offen hält.
- **Änderungen erscheinen nicht im Frontend**: Service Worker einmal über den Browser oder per Hard-Reload zurücksetzen.
- **Login schlägt fehl**: überprüfen, ob Cookies blockiert werden bzw. `SESSION_SECRET` gesetzt ist.

Viel Spaß beim Automatisieren eures Familien-Rewardsystems! Pull Requests und Erweiterungen sind willkommen.
