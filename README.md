Reward Server (Tasks, Credits, Rewards)

Kurz: Lokaler Node.js-Server zum Verwalten von Haushalts-Tasks (Teen markiert fertig → Eltern genehmigen → Credits werden gutgeschrieben) und Rewards (Teen löst ein, Credits werden abgezogen). Enthält eine minimale Web-Oberfläche, nutzbar auf iPhone per Safari (optional als PWA speicherbar).

Setup
- Node.js 18+
- Erstelle eine `.env` aus `.env.example` und trage deine PINs ein:

```
cp .env.example .env
# Editiere .env (ADMIN_PIN, USER_PIN, PORT)
```

Installieren & Starten
```
npm install
npm run dev   # mit Neustart bei Dateiänderung
# oder
npm start
```

Aufruf
- Browser: http://localhost:3000
- Header-Auth: `x-pin: <PIN>`
  - Admin-PIN: `ADMIN_PIN`
  - User-PIN: `USER_PIN`

Login im Browser (Benutzerverwaltung)
- Beim ersten Start wird automatisch ein Admin angelegt:
  - Benutzer: aus `.env` `ADMIN_USERNAME` (Standard: `admin`)
  - Passwort: aus `.env` `ADMIN_PASSWORD` (Standard: `admin`)
- Öffne `http://localhost:3000` und melde dich an.
- Admin kann unter „Anlegen (Admin)“ Tasks/Rewards erstellen.
- Unter der Haube werden Sessions (Cookies) verwendet; kein PIN mehr nötig.

Weitere Benutzer (Teen) anlegen
- Als Admin einloggen.
- Per API: `POST /auth/register` Body `{ username, password, role: 'user' }`.
- Optional kann ich eine kleine UI für Benutzeranlage ergänzen – sag Bescheid.

Wiederkehrende Aufgaben (Recurring)
- Admin kann Vorlagen für wiederkehrende Tasks erstellen (z. B. „Bad reinigen“, „Katzenklo“):
  - UI: Bereich „Wiederkehrende Aufgaben“ (Titel, Credits, Beschreibung, Frequenz täglich/wöchentlich, optional Startdatum)
  - API: `POST /recurring` `{ title, description?, credits, frequency: 'daily'|'weekly', startDate?: 'YYYY-MM-DD' }`
- Der Server erzeugt fällige Tasks automatisch beim Abruf der Taskliste (`GET /tasks`) oder auf Knopfdruck „Jetzt erzeugen“.
- Verwaltung:
  - `GET /recurring` (admin) — Liste der Vorlagen
  - `PATCH /recurring/:id` (admin) — aktivieren/deaktivieren, Felder ändern
  - `DELETE /recurring/:id` (admin) — Vorlage löschen
  - `POST /recurring/:id/run` (admin) — sofort auslösen

Vom iPhone
- Stelle sicher, dass Server und iPhone im selben WLAN sind.
- Rufe `http://<PC-IP>:3000` auf (z. B. `http://192.168.1.10:3000`).
- Optional: In Safari „Zum Home-Bildschirm“ hinzufügen, dann wie App nutzbar.

API (Auszug)
- GET `/tasks` — alle Tasks (optional `?status=open|pending_approval|approved`)
- POST `/tasks` (admin) — `{ title, credits, description }`
- PATCH `/tasks/:id/complete` (user)
- PATCH `/tasks/:id/approve` (admin)
- PATCH `/tasks/:id/reject` (admin)
- DELETE `/tasks/:id` (admin)

- GET `/rewards` - aktive Rewards
- POST `/rewards` (admin) - `{ title, cost, description, one_time? }`
- PATCH `/rewards/:id` (admin)
- DELETE `/rewards/:id` (admin)
- POST `/rewards/:id/redeem` (user)
- POST `/rewards/:id/allocate` (user) - `{ amount }` Credits reservieren (+) oder wieder freigeben (-) für Sparziele

- GET `/balance` - `{ balance }`
- GET `/ledger` - Transaktionen

Hinweise
- Daten werden lokal in `data/app.db` (SQLite) gespeichert. Sessions in `data/sessions.db`.
- Auth jetzt: Benutzername/Passwort mit Session-Cookie.
- UI: Login-Formular, Rollen-basierte Buttons (Admin vs. Teen).

PWA (Add to Home Screen)
- Die App registriert einen Service Worker (`public/sw.js`) und ein Manifest (`public/manifest.webmanifest`).
- iPhone/iOS (Safari):
  - Seite `http://<PC-IP>:3000` öffnen
  - Teilen-Symbol → „Zum Home-Bildschirm“
  - Startet dann im Vollbild (Standalone)
- Offline-Verhalten:
  - Die Oberfläche (App-Shell) lädt offline aus dem Cache.
  - Daten (Tasks/Rewards/Saldo) werden bei Onlinezugriff aktualisiert und als Fallback zwischengespeichert.
  - Aktionen (Erstellen/Genehmigen/Einlösen) benötigen Internet/Server.

App-Icon
- Vektor-Icon: `public/icons/icon.svg` ist hinterlegt und im Manifest verknüpft (Chrome/Android, Desktop).
- iOS-Homescreen: Für bestes Ergebnis bitte ein PNG hinzufügen:
  - Erstelle `public/icons/apple-touch-icon.png` (180×180 px, quadratisch, mit Rand).
  - Optional zusätzlich PNGs `icon-192.png` und `icon-512.png` und in `manifest.webmanifest` ergänzen.
  - Nach dem Hinzufügen: Server neu starten, Seite neu laden, PWA ggf. neu zum Home-Bildschirm hinzufügen.

Discord-Benachrichtigungen (optional)
- Erzeuge in Discord (Server deiner Tochter) einen Kanal‑Webhook:
  - Server Einstellungen → Integrationen → Webhooks → Neuer Webhook → URL kopieren
- In `.env` die URL setzen: `DISCORD_WEBHOOK_URL=...`
- Ereignisse, die eine Nachricht schicken:
  - Neue Aufgabe erstellt (Admin)
  - Task abgeschlossen (wartet auf Genehmigung)
  - Task genehmigt/abgelehnt
  - Reward eingelöst
  - Ledger-Korrektur und Löschung
  - Automatisch erzeugte wiederkehrende Aufgaben (Sammelmeldung)
