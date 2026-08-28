/**
 * Auflösung des JWT-Signaturschlüssels.
 *
 * Liegt bewusst in einem eigenen Modul: auth.ts importiert `next/headers` und
 * lässt sich deshalb nicht in einem Node-Test laden. Die Regel hier ist aber
 * genau die, die man testen will.
 *
 * Vorher stand in auth.ts nur:
 *
 *     const raw = process.env.JWT_SECRET || 'dev-fallback-secret-change-me';
 *
 * Der Rückfallwert galt auch in Produktion, und im ganzen Projekt gab es keine
 * einzige Stelle, die das Fehlen der Variablen bemerkt hätte. Wäre JWT_SECRET auf
 * Vercel leer, würden alle Sessions mit einer Konstante signiert, die öffentlich
 * im Repository steht — damit liesse sich jedes Token fälschen, auch ein
 * administratives. Die App liefe dabei völlig unauffällig weiter.
 *
 * Deshalb: in Produktion lieber laut scheitern als leise unsicher laufen.
 */

/** Nur für die lokale Entwicklung. Bewusst als Konstante sichtbar, nicht geheim. */
export const DEV_FALLBACK_SECRET = 'dev-fallback-secret-change-me';

/** Ab hier gilt ein Schlüssel als zu kurz für HS256. Führt zu einer Warnung, nicht zum Abbruch. */
export const MIN_SECRET_LENGTH = 32;

export class MissingJwtSecretError extends Error {
  constructor(grund: string) {
    super(
      `JWT_SECRET ${grund}. In Produktion ist die Variable zwingend: ohne sie ` +
      `würden alle Sessions mit einer öffentlich bekannten Konstante signiert und ` +
      `liessen sich fälschen. Setzen mit: openssl rand -hex 32`,
    );
    this.name = 'MissingJwtSecretError';
  }
}

/**
 * Liefert den zu verwendenden Schlüssel oder wirft.
 *
 * `warn` wird für Meldungen genutzt, die nicht zum Abbruch führen — als Parameter,
 * damit der Test sie prüfen kann, statt in die Konsole zu schreiben.
 */
export function resolveJwtSecret(
  secret: string | undefined,
  nodeEnv: string | undefined,
  warn: (msg: string) => void = () => {},
): string {
  const raw = (secret ?? '').trim();
  const istProduktion = nodeEnv === 'production';

  if (!raw) {
    if (istProduktion) throw new MissingJwtSecretError('ist nicht gesetzt oder leer');
    return DEV_FALLBACK_SECRET;
  }

  // Der Rückfallwert explizit gesetzt ist genauso unsicher wie gar keiner.
  if (raw === DEV_FALLBACK_SECRET) {
    if (istProduktion) throw new MissingJwtSecretError('steht auf dem Entwicklungs-Rückfallwert');
    return raw;
  }

  // Zu kurz ist schwach, aber nicht wertlos — hier zu werfen würde eine laufende
  // Installation abschalten, die immerhin einen eigenen Schlüssel hat.
  if (raw.length < MIN_SECRET_LENGTH) {
    warn(`JWT_SECRET ist nur ${raw.length} Zeichen lang, empfohlen sind mindestens ${MIN_SECRET_LENGTH}.`);
  }

  return raw;
}
