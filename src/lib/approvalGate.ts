/**
 * Freischalt-Gate für Template-Rezepte.
 *
 * Ein Rezept darf erst dann sichtbar werden, wenn der rechtliche Status geklärt ist
 * und kein fremdes Bild verlinkt wird. Zuvor liess sich `approved` unabhängig davon
 * setzen — genau dieser Fehler ist bereits eingetreten (importierte Entwürfe wurden
 * per Massen-Freigabe sichtbar).
 *
 * Bewusst in src/lib/ statt in der Route: die Admin-Route braucht die Funktion, und
 * hier ist sie ohne Next.js-Laufzeit testbar (gleiche Begründung wie src/lib/urlGuard.ts).
 */

import type { Recipe } from '@/types';

export interface ApprovalCheck {
  ok: boolean;
  /** Kurzer deutscher Satz — taugt direkt als Tooltip im Admin-UI. */
  reason?: string;
}

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
 * Prüft, ob ein Rezept auf `approved: true` gesetzt werden darf.
 * Alle Bedingungen müssen erfüllt sein.
 */
export function canApprove(recipe: Recipe): ApprovalCheck {
  if (!recipe.licenseStatus) {
    return { ok: false, reason: 'Freigabe blockiert: Lizenzstatus ist nicht gesetzt.' };
  }
  if (recipe.licenseStatus === 'unclear') {
    return { ok: false, reason: 'Freigabe blockiert: Lizenzstatus ist «unclear» — Herkunft zuerst klären.' };
  }

  if (recipe.imageUrl != null && !isOwnImageUrl(recipe.imageUrl)) {
    return {
      ok: false,
      reason: 'Freigabe blockiert: Das Bild liegt auf einer fremden Domain. Eigenes Foto hochladen.',
    };
  }

  if (recipe.sourceType === 'imported' && !recipe.rewrittenAt) {
    return {
      ok: false,
      reason: 'Freigabe blockiert: Importiertes Rezept ohne Zeitstempel der Neufassung (rewrittenAt).',
    };
  }

  return { ok: true };
}
