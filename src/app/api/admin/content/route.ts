export const dynamic = 'force-dynamic';

/**
 * Admin-only API for landing page CMS content.
 * GET  — return current LandingContent (reviews, features, plans)
 * PUT  — save new LandingContent to Redis (prod) or data/landing-content.json (dev)
 */

import { NextResponse }            from 'next/server';
import { getSession, ADMIN_EMAIL } from '@/lib/auth';
import { getLandingContent, setLandingContent } from '@/lib/content';
import type { LandingContent }     from '@/lib/content';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  const content = await getLandingContent();
  return NextResponse.json(content);
}

export async function PUT(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  let body: LandingContent;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON.' }, { status: 400 });
  }

  // Basic shape validation
  if (!Array.isArray(body?.reviews) || !Array.isArray(body?.features) || !Array.isArray(body?.plans)) {
    return NextResponse.json({ error: 'Fehlende Felder: reviews, features oder plans.' }, { status: 400 });
  }

  await setLandingContent(body);
  return NextResponse.json({ ok: true });
}
