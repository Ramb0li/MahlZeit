export const dynamic = 'force-dynamic';

/**
 * Einmalige Massen-Freigabe aller Template-Rezepte (approved = true).
 *
 * Hintergrund: Vorschläge nutzen ab jetzt nur freigegebene Rezepte (strenge Kuratierung,
 * konsistent mit der Anzeige). Damit der bestehende Bestand sofort verfügbar ist, gibt
 * dieser Endpoint den gesamten Template-Katalog einmalig frei. Künftige Importe bleiben
 * via `approved: false` (Default in POST /api/recipes & Import) gesperrt.
 *
 * Idempotent — pro Rezept im Admin wieder einzeln zurücknehmbar.
 */

import { NextResponse }                            from 'next/server';
import { getSession, ADMIN_EMAIL }                 from '@/lib/auth';
import { getTemplateRecipes, saveTemplateRecipes } from '@/lib/data';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

export async function POST() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const templates       = await getTemplateRecipes();
  const alreadyApproved = templates.filter(r => r.approved === true).length;
  const updated         = templates.map(r => (r.approved === true ? r : { ...r, approved: true }));

  await saveTemplateRecipes(updated);

  return NextResponse.json({
    ok:            true,
    total:         updated.length,
    newlyApproved: updated.length - alreadyApproved,
  });
}
