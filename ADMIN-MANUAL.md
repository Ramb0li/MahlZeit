# MahlZeit — Rezeptverwaltung via Admin-Panel

**URL:** https://mahlzeit.o-v-k.ch/admin  
**Zugang:** Admin-Login-Daten (per separater Nachricht)

---

## Rezepte verwalten

### Tab "Rezepte" öffnen

Nach dem Login oben im Tab **Rezepte** klicken.

Die Tabelle zeigt alle verfügbaren Template-Rezepte. Oben links kann nach Name gesucht und nach Kategorie gefiltert werden.

---

### Rezept bearbeiten

1. In der Tabelle auf **Bearbeiten** (Stift-Icon) klicken
2. Felder anpassen: Name, Kategorie, Portionen, Zutaten, Anleitung, Tags usw.
3. **Speichern** klicken — Änderung ist sofort live

---

### Neues Rezept erstellen

1. Button **+ Neues Rezept** klicken
2. Alle Pflichtfelder ausfüllen:
   - **ID** — eindeutiger Kurzname, nur Kleinbuchstaben und Bindestriche (z.B. `linsen-curry`)
   - **Name** — sichtbarer Rezeptname
   - **Kategorie** — aus der Dropdown-Liste wählen
   - **Zutaten** — eine pro Zeile, Format: `Menge Einheit Zutat` (z.B. `200 g Linsen`)
   - **Anleitung** — Schritte als Text
3. **Speichern** klicken

---

### Bild hinzufügen

Innerhalb des Rezept-Formulars gibt es drei Bildfelder:

| Feld | Verwendung |
|---|---|
| **Hauptbild** | Wird in der Rezeptliste und im Planer angezeigt |
| **Zutaten-Bild** | Optional, zeigt Zutatenlayout |
| **Koch-Bild** | Optional, zeigt Kochprozess |

**Bild hochladen:**
1. Auf das Bildfeld klicken oder auf **Datei wählen**
2. Bild aus deinen Dateien auswählen (JPG/PNG, max 8 MB)
3. Das Bild lädt automatisch hoch — kurz warten bis "Hochladen…" verschwindet
4. Danach **Speichern** klicken um das Bild am Rezept zu verknüpfen

Das Bild wird auf einem CDN gespeichert und ist sofort öffentlich verfügbar.

---

### Rezept löschen

In der Tabelle auf das **Löschen-Icon** (Papierkorb) klicken → Bestätigen.

---

## Rezepte per KI importieren

1. Button **Importieren** klicken
2. Entweder eine **URL** (Rezept-Website) oder ein **Screenshot/Foto** hochladen
3. Die KI liest das Rezept automatisch ein und befüllt das Formular
4. Felder prüfen, ggf. anpassen → **Speichern**

---

## Hinweise

- Alle Änderungen werden sofort in der App sichtbar — kein Neustart nötig
- Beim nächsten Deployment bleiben die Rezepte erhalten (gespeichert in Redis)
- Bilder bleiben dauerhaft verfügbar, auch wenn das Rezept später angepasst wird

---

## Nur für den Admin (technische Funktionen)

| Funktion | Beschreibung |
|---|---|
| **Export JSON** | Lädt alle aktuellen Rezepte als JSON-Datei herunter (Backup / lokale Synchronisation) |
| **Seed Redis** | Überschreibt Redis mit dem aktuellen Code-Bundle — nur nach einem neuen Deployment verwenden, wenn neue Rezepte aus dem Code geladen werden sollen |

> **Warnung:** "Seed Redis" überschreibt alle manuellen Änderungen in Produktion. Vorher "Export JSON" machen wenn Änderungen gesichert werden sollen.
