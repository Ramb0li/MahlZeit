export const dynamic = 'force-dynamic';

import { NextResponse }  from 'next/server';
import { put }           from '@vercel/blob';
import { getSession }    from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.groupId)
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json(
      { error: 'Bild-Upload nicht konfiguriert (BLOB_READ_WRITE_TOKEN fehlt).' },
      { status: 503 },
    );

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const file = form.get('file') as File | null;
  if (!file || file.size === 0)
    return NextResponse.json({ error: 'Kein File angegeben.' }, { status: 400 });

  if (file.type !== 'image/jpeg' && file.type !== 'image/png')
    return NextResponse.json({ error: 'Nur JPG und PNG erlaubt.' }, { status: 400 });

  if (file.size > 1 * 1024 * 1024)
    return NextResponse.json({ error: 'Datei zu gross (max 1 MB).' }, { status: 400 });

  const ext      = file.type === 'image/png' ? 'png' : 'jpg';
  const basename = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const blobName = `user-recipes/${session.groupId}/${basename}-${Date.now()}.${ext}`;

  let blob: { url: string };
  try {
    blob = await put(blobName, file, { access: 'public' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[user-upload] Vercel Blob error:', msg);
    return NextResponse.json({ error: `Upload fehlgeschlagen: ${msg}` }, { status: 502 });
  }

  return NextResponse.json({ url: blob.url });
}
