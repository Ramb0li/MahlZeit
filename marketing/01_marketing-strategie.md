# MahlZeit – Marketing-Strategie

*Stand: Juni 2026 | Intern*

---

## 1. Produkt-Übersicht: Was kann MahlZeit?

### Kern-Features

**Intelligente Wochenplanung**
- KI-Wochenplan auf Knopfdruck: vollständige Woche in Sekunden vorgeschlagen
- Wetter-basierte Vorschläge via Meteoblue (z.B. warme Suppen bei Regen, Salate bei Hitze) — kein Konkurrent bietet das
- Saison-basierte Rezeptauswahl (Frühling / Sommer / Herbst / Winter)
- Einzelne Mahlzeiten neu würfeln (Frühstück, Mittag, Abend separat)
- Tages-Constraints: maximale Kochzeit pro Tag, Mealprep-Tage, Restetage
- Flexitarisch-Modus: automatisch max. 1 Fleischgericht pro Woche

**Rezeptdatenbank**
- 172+ sorgfältig ausgewählte und getestete Rezepte
- 13 Kategorien (Frühstück, Pasta, Fleisch & Geflügel, Vegetarisch, Fisch, Salate, etc.)
- Tags: Saison, Küche (CH, IT, Asien, MEX, Orient), Kochmethode, Diätform
- Dietkategorien: Fleischhaltig, Pescetarisch, Vegetarisch, Vegan
- 14 EU-Pflichtallergene pro Rezept
- KI-geschätzte Nährwerte pro Portion (kcal, Protein, Fett, Kohlenhydrate, Ballaststoffe)
- Bilder (Rezept, Zutaten, Kochprozess)
- Bewertungssystem (1–5 Sterne + Kommentar)
- Rezept-Import per URL oder Screenshot (Claude Haiku KI)

**Digitales Chuchichäschtli (Pantry)**
- Eigenen Vorrat digital erfassen
- "Aufbrauchen"-Funktion: Rezepte vorschlagen die aus vorhandenen Zutaten gekocht werden können
- Automatischer Abgleich mit Einkaufsliste

**Einkaufsliste**
- Automatisch aus Wochenplan generiert
- Portionen-skaliert auf Haushaltsgrösse (Erwachsene + Kinder)
- Geteilter Einkaufslistenstatus im Haushalt (Live-Sync)
- Eigene Artikel manuell hinzufügen
- Mengen-Override pro Artikel
- Shopping Groups: Woche aufteilen (z.B. Mo-Mi + Do-So = zwei separate Einkäufe)
- Schweizer Supermarkt-Aktionen eingeblendet: Migros, Coop, Lidl
- PDF-Export

**Haushalt & Gruppen**
- Mehrbenutzer-Modus: Haushaltsmitglieder teilen Wochenplan, Einkaufsliste und Pantry
- Einladung per E-Mail
- Portionen-Einstellungen (Erwachsene + Kinder inkl. Alter)
- Allergien & Abneigungen hinterlegen (Rezepte automatisch ausgefiltert)

**Onboarding & Personalisierung**
- 6-Schritte Onboarding-Wizard (Familienname, Ort, Portionen, Diät, Allergien, Einkaufsrhythmus)
- Wochenumschalt-Tag frei wählbar
- Themes (Farbschema)
- Frühstück/Mittag/Abend einzeln aktivierbar

**Abos & Preise**
- Monatsabo: CHF 4.–
- Jahresabo: CHF 40.– (entspricht CHF 3.33/Monat)
- Lifetime (erste 100 User): CHF 129.–

---

## 2. Wettbewerbsanalyse

### fooby.ch (Coop)

| Merkmal | fooby | MahlZeit |
|---|---|---|
| Rezepte | Tausende | 172+ (kuratiert) |
| KI-Wochenplan | Nein (manueller Menü-Konfigurator) | Ja |
| Wetterbasiert | Nein | Ja |
| Saisonal | Teilweise (redaktionell) | Ja (automatisch) |
| Einkaufsliste | Einfach | Vollautomatisch + PDF + Gruppen |
| Pantry/Chuchichäschtli | Nein | Ja |
| Supermarkt-Aktionen | Nein (Coop-Werbung) | Migros, Coop, Lidl |
| Gruppen-Haushalt | Nein | Ja |
| Preismodell | Kostenlos (Coop-Marketing) | Freemium + Abo |
| App | iOS/Android | Webapp (kein Download) |
| Fokus | Content/Inspiration | Planung & Effizienz |

**Schwäche fooby:** Reines Inspirations-Tool. Wer planen will, steht allein da. Kein KI, kein Pantry, kein echter Automatismus. Coop-gebunden.

---

### le menu (Medienart AG)

| Merkmal | le menu | MahlZeit |
|---|---|---|
| KI-Wochenplan | Nein (redaktioneller Newsletter) | Ja |
| Interaktiv | Wenig | Vollständig |
| Einkaufsliste | Nein | Ja |
| Pantry | Nein | Ja |
| Zielgruppe | Kochbegeisterte Leser | Planende Familien |
| Preismodell | Magazin-Abo | App-Abo (günstiger) |
| Tech-Niveau | Niedrig (WordPress) | Hoch (Next.js, KI) |

**Schwäche le menu:** Digitalkanal eines Printmagazins, kein echtes Tool. Wochenplan = PDF-Download, kein interaktives Erlebnis.

---

### Choosy (DE)

| Merkmal | Choosy | MahlZeit |
|---|---|---|
| KI-Mahlzeitenplanung | Ja | Ja |
| Wetterbasiert | Nein | Ja |
| Supermarkt-Integration | REWE (DE) | Migros, Coop, Lidl (CH) |
| Pantry | Ja | Ja |
| Gruppen-Haushalt | Nein | Ja |
| Rezept-Import | Ja (URL) | Ja (URL + Screenshot) |
| Preis/Monat | €5.99 | CHF 4.– |
| Plattform | Native App (iOS/Android) | Webapp (überall ohne Download) |
| Schweizer Fokus | Nein (DE-zentriert) | Ja (CH-Supermarkt, CH-Rezepte) |
| Klimafreundlich-Label | Ja | Nein (noch nicht) |
| Authentizität | Anonym/tech | @cuiselin – echte Gerichte |

**Schwäche Choosy:** Kein Schweizer Fokus, keine Wetterintegration, kein geteilter Haushalt, keine echte Authentizität hinter den Rezepten. Deutschland-zentriert.

---

## 3. USP – Was macht MahlZeit einmalig?

**Primärer USP:**
> *"Der einzige Menüplaner der weiss, wie das Wetter morgen ist."*

MahlZeit kombiniert als einzige Lösung im DACH-Raum: KI-Wochenplanung + Live-Wetter + Saisonalität + Schweizer Supermarkt-Aktionen + digitales Chuchichäschtli + geteiltem Haushalt.

**Sekundäre USPs:**
- 100% Webapp: kein App-Download, sofort auf allen Geräten
- Echte Rezepte von echten Menschen (@cuiselin, getestet)
- Schweizer Tonalität (Chuchichäschtli, Migros/Coop/Lidl-Aktionen)
- Günstigstes KI-Planungs-Abo im DACH-Raum (CHF 4/Monat)
- Lifetime-Deal für Early Adopters
- Familien-first: Kinder-Portionen, Allergien, Mealprep-Tage, Constraints

---

## 4. Zielgruppe

**Primär: Die planende Familie (25–45 Jahre, Schweiz)**
- Paare/Familien mit Kindern die strukturiert planen wollen
- Berufstätig, wenig Zeit, hoher Anspruch an Essen
- Schmerzpunkt: "Was kochen wir diese Woche?" + Einkaufszettel-Chaos
- Digital affin, nutzt bereits Coop/Migros App für Einkauf

**Sekundär: Meal-Prepper und Gesundheitsbewusste**
- Wollen Woche strukturieren
- Achten auf Diät (Vegan, Vegetarisch, Flexitarisch)
- Wollen Lebensmittelverschwendung reduzieren (Pantry-Feature)

**Tertiär: Deutsche Familien (Expansion)**
- Langfristig mit DE-Supermarkt-Integration (REWE/Edeka)

---

## 5. Go-to-Market: Schritte zu den ersten Abo-Käufen

### Phase 1 – Fundament legen (Monat 1–2)

**SEO & Landing Page**
- Landing Page mit Problem/Solution Story live schalten
- On-Page-SEO: Keywords "Menüplan Schweiz", "Wochenplan Essen App", "Was soll ich heute kochen", "Einkaufsliste Wochenplan Schweiz"
- Blog-Artikel: "Warum ein Wochenplan spart Zeit und Geld", "Wetter und Essen: Warum wir im Winter anders kochen"
- Google Search Console + Vercel Analytics einrichten

**Social Media Profil aufbauen**
- @mahlzeit.app auf Instagram erstellen (oder an @cuiselin anbinden)
- Wöchentlich 3 Posts: 1x Rezept, 1x App-Feature-Highlight, 1x Alltagsstory (Storytelling)
- Reels: 30-60 Sek. App-Walkthrough, Wochenplan in 60 Sekunden

**Freundeskreis & frühe User**
- Persönliche Einladungen an Freunde, Familie, Bekannte
- Lifetime-Deal aktiv bewerben: "Erste 100 User, CHF 129 einmalig"
- Feedback sammeln, App-Review-Loop starten

### Phase 2 – Sichtbarkeit gewinnen (Monat 2–4)

**@cuiselin als Sprungbrett nutzen**
- Rezepte von @cuiselin direkt in der App verlinkt = sofort glaubwürdig
- Célines IG-Account: Story-Highlights "In der App" – direkter CTA zur MahlZeit-Webapp
- Crossposting: Rezept auf cuiselin + Link zu MahlZeit-Feature

**Micro-Influencer & Food-Blogger DACH**
- Kontakt zu 5–10 Schweizer Food-Bloggern / Family-Content-Creatorn
- Gratis Premium-Zugang im Tausch gegen ehrliche Story/Post
- Ziel: 2–3 authentische Testimonials

**PR / Media**
- Pressemitteilung an: 20min.ch, Migros-Magazin, Beobachter, Coop-Zeitung, Annabelle
- Story-Aufhänger: "Basler Paar entwickelt App gegen das tägliche 'Was essen wir heute?'"
- Community-Foren: local.ch, Reddit r/Switzerland, Schweizer Facebook-Gruppen (Kochen, Familie)

### Phase 3 – Conversion optimieren (Monat 3–6)

**Freemium-Modell schärfen**
- Klar definieren welche Features kostenlos vs. bezahlt (heute noch unklar)
- Empfehlung: Gratis = 5 Rezepte/Woche + manuelle Einkaufsliste | Premium = KI-Vorschlag + Wetter + Pantry + Gruppen
- 30-Tage kostenlose Testphase für Premium

**Werbevideo schalten**
- 60-Sek. Video auf Instagram Reels + YouTube Shorts
- Paid Boost auf Instagram (CHF 5–10/Tag, Targeting: CH, 25–45, Familie, Kochen)

**Referral-Programm**
- "Empfehle MahlZeit und erhalte 1 Monat gratis"

**E-Mail Sequenz**
- Onboarding-E-Mail Tag 1: Willkommen + Erste Schritte
- Tag 3: "Hast du schon deinen ersten KI-Plan erstellt?"
- Tag 7: Tip der Woche + Upgrade-CTA
- Tag 14: Lifetime-Deal-Erinnerung (läuft ab!)

### Phase 4 – Skalierung (Monat 6+)

- App-Store-Listing (PWA / native Wrapper)
- REWE/Edeka-Integration für DE-Markt
- Kooperation mit Migros/Coop (Aktionen live in App)
- Influencer-Kampagne mit Budget
- Google Ads: "Wochenplan App Schweiz"

---

## 6. Preisempfehlung & Positionierung

| Tier | Preis | Inhalt |
|---|---|---|
| Gratis | CHF 0 | Bis 5 Rezepte, manuelle Planung, keine KI |
| Monatsabo | CHF 4.– | Alles: KI-Plan, Wetter, Pantry, Gruppen, PDF |
| Jahresabo | CHF 40.– (–17%) | Wie Monatsabo |
| Lifetime (Early Bird) | CHF 129.– | Einmalig, für erste 100 User |

**Positionierung:** MahlZeit ist das günstigste vollwertige KI-Küchen-Tool im DACH-Raum. Choosy kostet 50% mehr und bietet weniger (kein Wetter, kein Haushalt, kein CH-Fokus).

---

## 7. KPIs für die ersten 6 Monate

| Metrik | Ziel |
|---|---|
| Registrierungen gesamt | 500 |
| Aktive User (monatlich) | 150 |
| Lifetime-Deals verkauft | 50 (von 100) |
| Monats-/Jahresabos | 80 |
| Monatlicher Umsatz (Monat 6) | CHF 400+ |
| Instagram-Follower | 500 |
| App-Store-Rating | 4.5+ |
