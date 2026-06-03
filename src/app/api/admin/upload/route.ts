export const dynamic = 'force-dynamic';

/**
 * Admin-only image upload to Vercel Blob.
 * Returns { url } — a permanent public CDN URL for the uploaded image.
 *
 * Requires BLOB_READ_WRITE_TOKEN in environment variables.
 * Set in Vercel Dashboard → Project Settings → Environment Variables.
 * Also add to .env.local for local development.
 */

import { NextResponse }           from 'next/server';
import { put }                    from '@vercel/blob';
import { getSession, ADMIN_EMAIL } from '@/lib/auth';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

export async function POST(request: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const file = form.get('file') as File | null;
  if (!file || file.size === 0)
    return NextResponse.json({ error: 'Kein File angegeben.' }, { status: 400 });

  // Limit to image files
  if (!file.type.startsWith('image/'))
    return NextResponse.json({ error: 'Nur Bilddateien erlaubt.' }, { status: 400 });

  // Max 8 MB
  if (file.size > 8 * 1024 * 1024)
    return NextResponse.json({ error: 'Datei zu gross (max 8 MB).' }, { status: 400 });

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json(
      { error: 'Bild-Upload nicht konfiguriert (BLOB_READ_WRITE_TOKEN fehlt).' },
      { status: 503 },
    );

  // Sanitize filename: keep extension, replace spaces/special chars
  const ext      = file.name.split('.').pop() ?? 'jpg';
  const basename = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const blobName = `recipes/${basename}-${Date.now()}.${ext}`;

  let blob: { url: string };
  try {
    blob = await put(blobName, file, { access: 'public' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] Vercel Blob error:', msg);
    return NextResponse.json(
      { error: `Upload fehlgeschlagen: ${msg}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: blob.url });
}
