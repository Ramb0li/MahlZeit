# Claude Code Prompt: Rezept-Import-Pipeline v2

Kopiere alles ab der Trennlinie in die offene Claude-Code-Session.

---

## Auftrag

Baue eine neue Import-Pipeline `scripts/import-recipes-v2.ts` und führe sie aus. Sie verarbeitet von uns kuratierte Quell-URLs (10 pro Kategorie) zu vollständigen MahlZyt-Rezepten im Entwurfsstatus.

**Arbeitsteilung (bitte exakt einhalten):**

| Ebene | Wer | Aufgabe |
|---|---|---|
| Deterministisch | TypeScript, kein LLM | Allergene, Einheiten, Duplikat-Check, Schema-Validierung, Freischalt-Gate |
| Batch | `claude-sonnet-5` im Script | Neuformulierung, Anreicherung, Tags, Kategorisierung |
| Review | Du selbst in dieser Session | Stichprobe, Eigenständigkeitsprüfung, Freigabeempfehlung |

Lies zuerst `scripts/import-fooby.ts` und `scripts/allergen-utils.ts`. Die neue Pipeline ersetzt `import-fooby.ts`; lösche das alte Script und seinen npm-Eintrag am Ende.

---

## Input

Ich lege dir eine Datei `data/import-queue.json` an:

```json
[
  { "url": "https://fooby.ch/de/rezepte/14229/lasagne-al-forno", "zielkategorie": "Pasta & Teigwaren" }
]
```

Falls die Datei fehlt, lege ein Beispiel-Gerüst an und stoppe mit einem Hinweis.

Die Auswahl treffen wir manuell, das ist bewusst so. Halte das im Code-Kommentar fest: kein Crawling, keine Kategorie-Listen, keine Sitemap, nur die in der Queue genannten URLs. Kein paralleler Abruf, `Crawl-delay: 10` respektieren, also mindestens 10 Sekunden Pause zwischen zwei Requests.

---

## Referenzrezept

Nimm `data/recipes/eier/ei-02.json` als verbindliche Struktur- und Stilvorlage. Lies es vollständig, bevor du das Prompt für Sonnet schreibst.

Stilmerkmale, die du daraus ableiten und im Sonnet-Prompt festschreiben sollst:

- `description`: 1 bis 3 Sätze, warm und persönlich, gern mit einer Alltagsbeobachtung. Kein Marketing, keine Superlative.
- `steps`: vollständige Sätze, **ohne** Nummerierungspräfix. Ein Schritt pro Array-Eintrag. Chronologisch. Konkrete Zeiten und Temperaturen.
- Schweizer Hochdeutsch, "ss" statt "ß": Rüebli, Peperoni, Rahm/Nidel, Poulet, andämpfen, beigeben, geniessen, anschliessend, Pfanne, Backofen.
- `ingredientGroups[].name` im Muster `Zutaten für <Komponente>`.

---

## Pro Rezept zu erzeugen

### 1. Name

Neuer, eigenständiger Name. Nicht der Originalname, auch keine Umstellung davon. Beschreibend nach Hauptkomponenten, so wie `ei-02` es macht.

### 2. `category`

Genau ein Wert aus `Category` in `src/types/index.ts`. Die `zielkategorie` aus der Queue ist die Vorgabe; wenn Sonnet abweicht, protokollieren und die Vorgabe gewinnt.

### 3. `dietCategory`

`meat` | `fish` | `vegetarian` | `vegan`. Deterministisch nachprüfen: enthält die Zutatenliste Fleisch, dann `meat`, unabhängig davon was das Modell sagt. Gleiches für Fisch und Meeresfrüchte.

### 4. `weatherType`

`warm` | `kalt` | `neutral`. Semantik: `kalt` = Gericht passt zu kaltem Wetter (Eintopf, Gratin, Suppe), `warm` = passt zu heissem Wetter (Salat, Kaltes, Leichtes). Prüfe die Verwendung in `src/lib/suggestions.ts`, bevor du das Prompt schreibst, und übernimm die dort gültige Bedeutung.

### 5. Quelle

```json
"source": "fooby.ch",
"sourceUrl": "<Original-URL>",
"sourceType": "imported",
"licenseStatus": "adapted",
"rewrittenAt": "<ISO-Zeitstempel>"
```

`sourceUrl`, `licenseStatus` und `rewrittenAt` gibt es noch nicht. Ergänze sie in `Recipe` in `src/types/index.ts`, alle optional, damit der Bestand gültig bleibt. `licenseStatus`: `'own' | 'licensed' | 'public-domain' | 'adapted' | 'unclear'`.

### 6. `description`

Sinngemäss neu, nicht übersetzt und nicht umgestellt. Stil nach `ei-02`.

### 7. `steps`

Sinngemäss neu, ein Array-Eintrag pro Schritt, ohne Nummerierung.

**Wichtig für den Sonnet-Prompt:** Gib dem Modell **nicht** den Originaltext der Zubereitung. Gib ihm die Zutatenliste, die Mengen, die Garzeiten und einen Stichwort-Ablauf (maximal 8 Stichworte, aus dem JSON-LD extrahiert). Das Modell schreibt die Anleitung daraus neu. Das ist der Unterschied zwischen Bearbeitung und Neufassung, und er entsteht im Prompt, nicht im Nachhinein.

### 8. `tags`

Ausschliesslich Werte aus `TAG_GROUPS` in `src/types/index.ts`. Validiere hart gegen die Konstante und wirf bei unbekannten Tags einen Fehler statt sie zu übernehmen. Ziel: aus jeder Gruppe passend zuordnen.

- Mahlzeit: mindestens einer
- Planung: was zutrifft
- Zubereitung: mindestens einer
- Saison: mindestens einer, `Ganzjährig` nur wenn wirklich saisonneutral
- Küche: genau einer, sofern zuordenbar

### 9. `suggestionEnabled`

Auf `true` setzen. Prüfe vorher in `src/lib/suggestions.ts`, ob `undefined` ohnehin als aktiv gilt; setze das Feld trotzdem explizit.

### 10. Bildreferenz

Das Originalbild dient ausschliesslich als interne Gestaltungsreferenz für unser späteres Eigenfoto.

- Ablage **ausserhalb des Repos**: `../Menüs/Referenz/Fooby/<neuer-titel-slug>.jpg`
- Verzeichnis anlegen, falls nicht vorhanden
- Slug aus dem **neuen** Namen, kleingeschrieben, Umlaute aufgelöst, Bindestriche
- Manifest `../Menüs/Referenz/Fooby/_manifest.json` mit `{ slug, rezeptId, neuerName, quellUrl, bildUrl, geladenAm }`
- **Nicht** nach `public/`, **nicht** ins Repo, **nicht** committen. Ergänze `.gitignore` entsprechend
- Im Rezept-JSON: `"imageUrl": null`. Kein Hotlink, unter keinen Umständen

### 11. `ingredientGroups`

Pro Komponente eine Gruppe, benannt `Zutaten für <Komponente>`. Bei einkomponentigen Rezepten eine einzige Gruppe.

`ingredients` (flaches Array) ist die Konkatenation aller Gruppen-Zutaten in Reihenfolge, inklusive Wiederholungen wie Olivenöl oder Salz. Genau so macht es `ei-02`. Baue das deterministisch aus den Gruppen, lass es nicht vom Modell erzeugen, und assertiere die Gleichheit.

Jede Zutat: `{ name, amount, unit, perPortions }`. Einheiten aus `g, kg, ml, dl, EL, TL, Stk, Zehe, Prise, Bund, Zweig`. Alles andere normalisieren oder Fehler werfen.

---

## Deterministisch, ohne LLM

1. **Allergene** ausschliesslich über `computeAllergens` aus `scripts/allergen-utils.ts`. Das Modell liefert hier nichts.
2. **Nährwerte** nicht im Import. Danach `npm run recipes:enrich` laufen lassen.
3. **Duplikat-Check** gegen alle 354 Bestandsrezepte über einen normalisierten Hash der Hauptzutaten (Gewürze, Öl, Salz, Pfeffer, Wasser ausgeschlossen). Bei Treffer überspringen und im Report vermerken.
4. **Schema-Validierung** gegen `Recipe` vor jedem Schreibvorgang.
5. **`"approved": false`** bei jedem erzeugten Rezept. Ausnahmslos.

---

## Freischalt-Gate

Das ist der wichtigste Teil des Auftrags, weil es einen bereits eingetretenen Fehler strukturell ausschliesst.

Implementiere serverseitig in `src/app/api/admin/recipes/route.ts` eine Funktion `canApprove(recipe): { ok: boolean, reason?: string }`. `approved` darf nur dann auf `true` gesetzt werden, wenn **alle** Bedingungen erfüllt sind:

- `licenseStatus` ist gesetzt und nicht `'unclear'`
- `imageUrl` ist `null` oder liegt auf einer eigenen Domain (Vercel Blob oder `/images/`). Externe Domains blockieren
- `rewrittenAt` ist gesetzt, wenn `sourceType === 'imported'`

Wende dieselbe Prüfung in `src/app/api/admin/recipes/approve-all/route.ts` an. `approve-all` darf keine Rezepte mehr freigeben, die das Gate nicht bestehen. Wenn du den Endpoint für verzichtbar hältst, schlage seine Entfernung vor, entferne ihn aber nicht ohne Rückfrage.

Zeige den Blockierungsgrund im Admin-UI als Tooltip am Statusbadge.

---

## Ablage und Build

- Eine Datei pro Rezept unter `data/recipes/<ordner>/<id>.json`
- Ordner- und ID-Präfix-Mapping aus `scripts/import-fooby.ts` übernehmen
- Nächste freie ID pro Präfix ermitteln, keine Lücken auffüllen
- Anschliessend `npm run recipes:build`
- npm-Skript: `"recipes:import-v2": "tsx scripts/import-recipes-v2.ts"`

Report nach `data/import-report-v2.json`: pro Rezept URL, alter Titel, neuer Titel, ID, Kategorie, Status, Warnungen, Duplikat-Treffer.

---

## Deine Aufgabe nach dem Lauf

Nicht nur ausführen, sondern beurteilen:

1. Nimm eine Stichprobe von 5 Rezepten und vergleiche Original und Neufassung. Urteile explizit: eigenständig formuliert oder nur umgestellt? Bei "umgestellt" das betreffende Rezept markieren und den Prompt nachschärfen, nicht das Ergebnis nachbessern.
2. Prüfe die Tag-Vergabe auf Plausibilität, besonders `Saison` und `Küche`.
3. Prüfe, ob `weatherType` mit der Semantik in `suggestions.ts` übereinstimmt.
4. Prüfe, ob die neuen Namen wirklich eigenständig sind.
5. Fasse zusammen, was manuell nachbearbeitet werden muss, bevor freigeschaltet werden kann.

Führe `npm run lint`, `npm run test` und `npm run build` aus und melde das Ergebnis.

---

## Randbedingungen

- Kein Rezept geht auf `approved: true`. Freigabe ist ausschliesslich manuell nach Redaktion und Eigenfoto.
- Kein Fremdbild in `public/` oder in `imageUrl`.
- Keine Übernahme von Originaltexten in die Datenbank, auch nicht in einem Kommentarfeld oder Zwischenspeicher.
- Der Rohabruf darf nicht persistiert werden, ausser dem JSON-LD-Auszug im Report.
