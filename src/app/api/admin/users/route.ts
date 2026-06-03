export const dynamic = 'force-dynamic';

import { NextResponse }                from 'next/server';
import { getSession, ADMIN_EMAIL }     from '@/lib/auth';
import { getAllUsers, updateUser, deleteUser } from '@/lib/users';

/** Guard: only the admin may call these routes. */
async function requireAdmin() {
  const session = await getSession();
  if (!session || session.email !== ADMIN_EMAIL) return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }
  const users = await getAllUsers();
  // Never return password hashes to the client
  const safe  = users.map(({ passwordHash: _pw, ...u }) => u);
  return NextResponse.json(safe);
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }
  const body = await request.json() as {
    email:        string;
    status?:      'active' | 'inactive' | 'pending';
    plan?:        'trial' | 'lifetime' | 'abo' | 'beta';
    accessUntil?: string | null;
  };
  const users = await getAllUsers();
  const user  = users.find((u) => u.email === body.email);
  if (!user) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 });
  const updated: typeof user = {
    ...user,
    ...(body.status ? { status: body.status } : {}),
    ...(body.plan   ? { plan:   body.plan   } : {}),
  };
  // accessUntil: Reihenfolge ist wichtig — Plan-Regel gewinnt über expliziten Wert
  if (body.plan === 'lifetime' || body.plan === 'beta') {
    // Diese Pläne haben kein Ablaufdatum; expliziter accessUntil-Wert wird ignoriert
    delete updated.accessUntil;
  } else if (body.accessUntil !== undefined) {
    // Admin setzt oder löscht Ablaufdatum für trial/abo
    updated.accessUntil = body.accessUntil ?? undefined;
  }
  await updateUser(updated);
  return NextResponse.json({ ok: true, user: updated });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }
  const { email } = await request.json() as { email: string };
  await deleteUser(email);
  return NextResponse.json({ ok: true });
}
