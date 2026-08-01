import { defineRouting } from 'next-intl/routing';

/**
 * Vorerst nur Deutsch.
 *
 * fr/it/en waren aktiv, obwohl nur rund 30 Strings übersetzt sind (Navigation,
 * Landing, Footer) — der gesamte Planer, die Rezepte, die Einkaufsliste, die
 * Einstellungen und alle E-Mails sind fest auf Deutsch. next-intl leitete per
 * Accept-Language automatisch weiter, womit Nutzer aus der Romandie und dem
 * Tessin auf /fr bzw. /it landeten und dort eine deutsche App vorfanden.
 *
 * Die Dateien messages/{fr,it,en}.json bleiben als Grundlage liegen. Zum
 * Reaktivieren einer Sprache: hier eintragen UND die Redirect-Regel in
 * next.config.mjs entfernen.
 */
export const routing = defineRouting({
  locales: ['de'],
  defaultLocale: 'de',
});
