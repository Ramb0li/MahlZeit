export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const MODEL      = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4096;

// ─── Tool schema — guarantees Claude returns valid structured JSON ──────────

const RECIPE_TOOL = {
  name: 'save_recipe',
  description: 'Speichere das extrahierte Rezept in strukturiertem Format.',
  input_schema: {
    type: 'object',
    properties: {
      name:               { type: 'string',  description: 'Rezeptname' },
      description:        { type: 'string',  description: 'Kurze appetitliche Beschreibung (1-2 Sätze)' },
      category:           { type: 'string',  enum: ['Eier','Reis','Pasta','Eintopf/Gratin','Fisch','Sonstige','Asiatisch','Ofen','Suppen','Salat/Bowl'] },
      timeMinutes:        { type: 'number',  description: 'Gesamtzeit in Minuten' },
      basePortions:       { type: 'number',  description: 'Anzahl Portionen' },
      dietType:           { type: ['string','null'], enum: ['vegan','vegetarisch','pescetarisch', null] },
      weatherType:        { type: 'string',  enum: ['warm','kalt','neutral'] },
      isMealprep:         { type: 'boolean' },
      isSuitableForLunch: { type: 'boolean', description: 'true wenn leicht & ≤30min' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:   { type: 'string' },
            amount: { type: 'number' },
            unit:   { type: 'string', description: 'g, kg, ml, l, EL, TL, Stk, Prise, Bund, Zehe' },
          },
          required: ['name','amount','unit'],
        },
      },
      steps: {
        type: 'array',
        items: { type: 'string', description: 'Sinngemäss auf Deutsch umformuliert' },
      },
    },
    required: ['name','category','timeMinutes','basePortions','weatherType','ingredients','steps'],
  },
} as const;

// ─── Claude helper using tool_use ───────────────────────────────────────────

async function extractRecipe(
  content: unknown,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch(CLAUDE_URL, {
    method:  'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:       MODEL,
      max_tokens:  MAX_TOKENS,
      tools:       [RECIPE_TOOL],
      tool_choice: { type: 'tool', name: 'save_recipe' },
      messages:    [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();

  if (data.stop_reason === 'max_tokens') {
    throw new Error('Antwort wurde abgeschnitten — bitte kürzere Quelle versuchen.');
  }

  const block = (data.content as Array<{ type: string; input?: unknown }> | undefined)
    ?.find(b => b.type === 'tool_use');
  if (!block?.input) {
    throw new Error('Claude konnte das Rezept nicht extrahieren.');
  }
  return block.input as Record<string, unknown>;
}

// ─── JSON-LD extraction ─────────────────────────────────────────────────────

function isRecipeType(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false;
  const type = (obj as Record<string, unknown>)['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of candidates) {
        if (isRecipeType(obj)) return obj;
        if (obj?.['@graph'] && Array.isArray(obj['@graph'])) {
          const found = (obj['@graph'] as unknown[]).find(isRecipeType);
          if (found) return found as Record<string, unknown>;
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }
  return null;
}

function parseIso8601Duration(d: unknown): number {
  if (!d || typeof d !== 'string') return 0;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(d);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0') * 60) + parseInt(m[2] ?? '0');
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function urlPrompt(jsonLd: Record<string, unknown>): string {
  return `Du bist ein Rezept-Import-Assistent. Extrahiere und normalisiere die folgenden JSON-LD Rezeptdaten in das vorgegebene Tool-Schema.

Regeln:
- Mengen in metrischen Einheiten (g, kg, ml, l, EL, TL, Stk, Prise, Bund, Zehe)
- Zubereitungsschritte SINNGEMÄSS auf Deutsch umformulieren (urheberrechtlich nicht 1:1 kopieren)
- Kategorie passend wählen
- dietType: 'vegan' = keine Tierprodukte, 'vegetarisch' = kein Fleisch/Fisch, 'pescetarisch' = Fisch aber kein Fleisch, sonst null
- weatherType: 'warm' = leichte Sommergerichte, 'kalt' = Suppen/Eintöpfe, 'neutral' = rest
- isSuitableForLunch: true wenn ≤ 30 Minuten und leicht

JSON-LD Daten:
${JSON.stringify(jsonLd).slice(0, 5500)}`;
}

function htmlPrompt(text: string): string {
  return `Du bist ein Rezept-Extraktor. Extrahiere das Rezept aus dem folgenden Webseitentext in das vorgegebene Tool-Schema. Zubereitungsschritte SINNGEMÄSS auf Deutsch umformulieren (nicht 1:1 kopieren).

${text}`;
}

const IMAGE_PROMPT_TEXT = `Du bist ein Rezept-Extraktor. Extrahiere alle Rezeptinformationen aus diesem Bild (Screenshot, Foto, Instagram-Post o.Ä.) in das vorgegebene Tool-Schema. Zubereitungsschritte sinngemäss auf Deutsch formulieren.`;

// ─── Route ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const isPremium =
      session.status === 'active' &&
      (session.plan === 'lifetime' || session.plan === 'abo');

    const body = await request.json() as {
      url?:         string;
      imageBase64?: string;
      mimeType?:    string;
    };

    // ── Image import (premium only) ───────────────────────────────────────
    if (body.imageBase64) {
      if (!isPremium) {
        return NextResponse.json({ error: 'Screenshot-Import ist nur für Premium-Nutzer verfügbar.' }, { status: 403 });
      }
      if (!body.mimeType) {
        return NextResponse.json({ error: 'mimeType fehlt' }, { status: 400 });
      }

      const recipe = await extractRecipe([
        { type: 'text',  text: IMAGE_PROMPT_TEXT },
        { type: 'image', source: { type: 'base64', media_type: body.mimeType, data: body.imageBase64 } },
      ]);

      return NextResponse.json({ recipe, source: 'image' });
    }

    // ── URL import (free) ─────────────────────────────────────────────────
    if (body.url) {
      const url = body.url.trim();
      if (!url.startsWith('http')) {
        return NextResponse.json({ error: 'Ungültige URL' }, { status: 400 });
      }

      let html: string;
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent':      'Mozilla/5.0 (compatible; MahlZeitPlaner/1.0; recipe-import)',
            'Accept':          'text/html,application/xhtml+xml',
            'Accept-Language': 'de,en;q=0.9',
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        html = await res.text();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: `URL nicht erreichbar: ${msg}` }, { status: 422 });
      }

      const jsonLd = extractJsonLd(html);
      let recipe: Record<string, unknown>;

      if (jsonLd) {
        recipe = await extractRecipe(urlPrompt(jsonLd));
      } else {
        const stripped = stripHtml(html);
        if (stripped.length < 100) {
          return NextResponse.json({ error: 'Kein Rezept auf dieser Seite gefunden.' }, { status: 422 });
        }
        recipe = await extractRecipe(htmlPrompt(stripped));
      }

      // Augment with structured JSON-LD fields if Claude missed them
      if (jsonLd) {
        if (!recipe.timeMinutes) {
          const t = parseIso8601Duration(
            (jsonLd.totalTime ?? jsonLd.cookTime ?? jsonLd.prepTime) as string,
          );
          if (t > 0) recipe.timeMinutes = t;
        }
        if (!recipe.basePortions && jsonLd.recipeYield) {
          const yld = jsonLd.recipeYield;
          const match = String(Array.isArray(yld) ? yld[0] : yld).match(/\d+/);
          if (match) recipe.basePortions = parseInt(match[0]);
        }
      }

      return NextResponse.json({ recipe, source: jsonLd ? 'json-ld' : 'html', url });
    }

    return NextResponse.json({ error: 'Weder url noch imageBase64 angegeben' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    console.error('[import]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
