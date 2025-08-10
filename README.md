# Gesamtliste – Next.js + MongoDB

Produktivfähige Anwendung zum Suchen, Bearbeiten und Exportieren (Excel / PDF / Word) von Schülerdaten (Klassen, Angebote, Schwerpunkte). Nutzt Next.js (App Router, TypeScript), MongoDB, Tailwind v4, clientseitige Exporte (xlsx, docx, jsPDF).

## Setup

1. Stelle sicher, dass eine MongoDB-Instanz läuft (z.B. lokal oder über MongoDB Atlas).
2. Trage die Verbindungsdaten in die Datei `.env.local` ein:
	```env
	MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
	```
3. Starte das Projekt:
	```powershell
	npm run dev
	```

## Wichtige Seiten
- `/seite2` – Suchen & Bearbeiten (nur Vorname / Familienname Suchkriterien)
- `/klassenliste` – Klassenliste mit Spaltenauswahl & Export
- `/angebote` – Angebote-Liste
- `/schwerpunkte` – Schwerpunkte (aggregiert aus Schwerpunkte / Schwerpunkt / Schwerpunkt 1)

## Hinweise
- Die MongoDB-Verbindung wird über die offizielle `mongodb`-Node.js-Bibliothek hergestellt.
- Für produktive Nutzung sollten Umgebungsvariablen und Fehlerbehandlung angepasst werden.

## Datenimport
JSON (bereits normalisiert) liegt in `data/import.json` oder via Argument:
```powershell
npm run import:data -- pfad/zur/datei.json
```
Import-Skript erledigt:
- Platzhalter `0`, `-`, `---` -> `null`
- Passwort Hashing (`Passwort` -> `PasswortHash`)
- Doppelte Benutzer werden über `NormBenutzername` (lowercase) bereinigt
- Upsert (idempotent), Teilindex auf `NormBenutzername`
- Angebote Normalisierung & Array
- Feldnamen mit `.` werden ersetzt

## Entwicklung
```powershell
npm install
npm run dev
```
Dev-Server: http://localhost:3000

## Deployment auf Vercel
1. Repository zu GitHub pushen.
2. In Vercel neues Projekt anlegen -> Repo auswählen.
3. Environment Variables setzen:
	- `MONGODB_URI`
	- `BCRYPT_SALT_ROUNDS` (z.B. 10)
4. Build Command (auto): `npm run build`
5. Output: automatisch durch Next.js.
6. Deploy.

Import in Produktion NICHT über Vercel build ausführen (ts-node), sondern lokal laufen lassen – die Daten landen in derselben Atlas-Datenbank.

## Technische Notizen
- Suche /seite2: Parameter `onlyNames=1` => Filter nur Vorname/Familienname
- Schwerpunkte: Aggregiert aus Schwerpunkte / Schwerpunkt / Schwerpunkt 1; Platzhalter wie "Schwerpunkt 1" werden aus der Auswahl entfernt.
- Exporte: komplett clientseitig; kein extra Server-Code nötig.
- Node Engine >= 18.18 konfiguriert.
