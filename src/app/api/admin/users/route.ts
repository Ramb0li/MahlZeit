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
  const { email, status } = await request.json() as { email: string; status: 'active' | 'inactive' };
  const users = await getAllUsers();
  const user  = users.find((u) => u.email === email);
  if (!user) return NextResponse.json({ error: 'Nutzer nicht gefunden' }, { status: 404 });
  await updateUser({ ...user, status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  }
  const { email } = await request.json() as { email: string };
  await deleteUser(email);
  return NextResponse.json({ ok: true });
}
