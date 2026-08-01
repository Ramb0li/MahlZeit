/**
 * Redaktionshinweise für Template-Rezepte.
 *
 * Früher war das eine harte Sperre (`canApprove`): der Server lehnte eine Freigabe
 * mit 422 ab, solange Lizenzstatus, Bildherkunft oder die Neufassung nicht sauber
 * waren. Das hat sich als zu streng erwiesen — die Redaktion entscheidet, nicht der
 * Code. Geblieben ist die Prüfung selbst, aber als Hinweis: das Admin-Panel zeigt
 * an, was an einem Rezept noch offen ist, freigeben lässt es sich trotzdem.
 *
 * Bewusst in src/lib/ statt in der Route: Route und UI brauchen dieselbe Funktion,
 * und hier ist sie ohne Next.js-Laufzeit testbar (gleiche Begründung wie urlGuard.ts).
 */

import type { Recipe } from '@/types';

/** Hosts, auf denen unsere eigenen Bilder liegen. */
const OWN_IMAGE_HOST_SUFFIX = '.public.blob.vercel-storage.com';

/** true, wenn das Bild auf einer eigenen Domain bzw. im eigenen public/-Ordner liegt. */
export function isOwnImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;                    // leer = kein Bild = unbedenklich

  // Repo-eigene Pfade
  if (trimmed.startsWith('/images/')) return true;

  // Alles andere muss eine absolute URL auf unserem Blob-Store sein
  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { return false; }
  if (parsed.protocol !== 'https:') return false;
  return parsed.hostname.toLowerCase().endsWith(OWN_IMAGE_HOST_SUFFIX);
}

/**
 * Sammelt alle offenen Punkte eines Rezepts. Leeres Array = nichts zu beanstanden.
 *
 * Bewusst alle Treffer statt nur des ersten: wer ein Rezept vor der Freigabe
 * durchsieht, will die vollständige Liste sehen und nicht nach jeder Korrektur
 * den nächsten Punkt einzeln nachgereicht bekommen.
 *
 * Ein fehlendes Bild ist ausdrücklich kein Hinweis — Rezepte dürfen ohne Foto
 * freigegeben werden. Beanstandet wird nur ein Bild auf fremder Domain.
 */
export function approvalWarnings(recipe: Recipe): string[] {
  const out: string[] = [];

  if (!recipe.licenseStatus) {
    out.push('Lizenzstatus ist nicht gesetzt.');
  } else if (recipe.licenseStatus === 'unclear') {
    out.push('Lizenzstatus ist «unclear» — Herkunft klären.');
  }

  if (recipe.imageUrl != null && !isOwnImageUrl(recipe.imageUrl)) {
    out.push('Das Bild liegt auf einer fremden Domain. Eigenes Foto hochladen.');
  }

  if (recipe.sourceType === 'imported' && !recipe.rewrittenAt) {
    out.push('Importiertes Rezept ohne Zeitstempel der Neufassung (rewrittenAt).');
  }

  return out;
}
