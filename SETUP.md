# MahlZeitPlaner – Setup-Anleitung

## 1. Node.js installieren

Falls noch nicht installiert:
- Download: https://nodejs.org (LTS-Version empfohlen)
- Nach Installation Terminal neu öffnen

## 2. Abhängigkeiten installieren

```bash
cd "path/to/mahlzeitplaner"
npm install
```

## 3. Entwicklungsserver starten

```bash
npm run dev
```

Öffne http://localhost:3000 im Browser.

## 4. Deployment auf Vercel (kostenlos)

```bash
# Vercel CLI installieren
npm install -g vercel

# Projekt deployen
vercel

# Bei Fragen: Enter drücken (Standardwerte übernehmen)
```

Wichtig: Vercel kann keine lokalen JSON-Dateien persistieren!
Für Produktion → Supabase oder Vercel KV einrichten (späterer Schritt).

## 5. Meteoblue API (optional)

- Registrierung: https://www.meteoblue.com/de/wetter/api/pricing
- Gratis-Plan: 50 Anfragen/Tag
- API-Key in Einstellungen eingeben

## Ordnerstruktur

```
mahlzeitplaner/
├── data/               ← JSON-Datenbank
│   ├── recipes.json    ← 45 Rezepte (vorgefüllt)
│   ├── weekplans.json  ← Wochenpläne
│   ├── constraints.json← Wöchentliche Events
│   ├── promotions.json ← Aktionen Cache
│   ├── weather.json    ← Wetter Cache
│   └── settings.json   ← Einstellungen
├── src/
│   ├── app/            ← Next.js App Router
│   ├── components/     ← React-Komponenten
│   ├── lib/            ← Hilfsfunktionen
│   └── types/          ← TypeScript-Typen
└── public/             ← Statische Dateien
```
